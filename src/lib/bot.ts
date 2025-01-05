import { Telegraf, Scenes, Context, session, Markup } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import { InlineKeyboardButton } from 'telegraf/types';
import { IWizardState , ICategory , ICustomContext, IProduct , IUser } from '@/types/bot';

const prisma = new PrismaClient();

export class TradingBot {
  private bot: Telegraf<ICustomContext>;
  private productScene: Scenes.WizardScene<any>;
  
  // Pagination settings
  private readonly ITEMS_PER_PAGE = 5;

  constructor(token: string) {
    this.bot = new Telegraf<ICustomContext>(token);
    this.productScene = this.createProductScene();
    this.setupMiddleware();
    this.setupCommands();
    this.setupCallbackQueries();
  }

  /**
   * Creates the scene for adding new products
  */

  private createProductScene(): Scenes.WizardScene<any> {
    return new Scenes.WizardScene<any>(
      'add_product',
      // Step 1: Category selection
      async (ctx) => {
        const categories = await prisma.category.findMany();
        ctx.wizard.state.categories = categories;
        
        // Create inline keyboard for categories
        const buttons: InlineKeyboardButton[][] = categories.map(cat => ([
          Markup.button.callback(`📁 ${cat.name}`, `select_category:${cat.id}`)
        ]));
        
        await ctx.reply(
          '🛍 Select a category for your product:',
          Markup.inlineKeyboard(buttons)
        );
        return ctx.wizard.next();
      },
      // Step 2: Handle category selection and ask for title
      async (ctx : any ) => {
        // Handle only callback queries for category selection
        if (!('callback_query' in ctx.update)) return;
        if (!ctx.callbackQuery?.data?.startsWith('select_category:')) return;
        
        const categoryId  : string = ctx.callbackQuery.data.split(':')[1];
        const category = ctx.wizard.state.categories.find(( c : ICategory) => c.id === categoryId);
        
        if (!category) {
          await ctx.reply('❌ Invalid category. Please try again.');
          return;
        }
        
        ctx.wizard.state.categoryId = category.id;
        await ctx.reply('📝 What is the title of your product?');
        return ctx.wizard.next();
      },
      // Step 3: Save title and ask for trades
      async (ctx) => {
        if (!ctx.message || !('text' in ctx.message)) return;
        ctx.wizard.state.title = ctx.message.text;
        await ctx.reply('🔄 What trades are you interested in?');
        return ctx.wizard.next();
      },
      // Step 4: Save product
      async (ctx) => {
        if (!ctx.message || !('text' in ctx.message) || !ctx.from) return;
        const state = ctx.wizard.state;
        
        try {
          // TODO : ADD redis 
          const user = await prisma.user.upsert({
            where: { tgId: ctx.from.id.toString() },
            update: { tg_username: ctx.from.username || undefined },
            create: {
              tgId: ctx.from.id.toString(),
              tg_username: ctx.from.username || undefined
            }
          });

          // Create new product
          const product = await prisma.product.create({
            data: {
              title: state.title,
              wanted_trades: ctx.message.text,
              userId: user.id,
              categoryId: state.categoryId,
              isTraded: false,
            },
            include: {
              category: true
            }
          });
          
          // Show success message with product details
          const productDetails = this.formatProductDetails(product);
          await ctx.reply(
            '✅ Product added successfully!\n\n' + productDetails,
            Markup.inlineKeyboard([
              [Markup.button.callback('View My Products', 'view_my_products')],
              [Markup.button.callback('Add Another Product', 'add_product')]
            ])
          );
        } catch (error) {
          console.error('Error adding product:', error);
          await ctx.reply('❌ Error adding product. Please try again.');
        }
        
        return ctx.scene.leave();
      }
    );
  }

  /**
   * Sets up middleware for the bot
   */
  private setupMiddleware(): void {
    const stage = new Scenes.Stage<ICustomContext>([this.productScene]);
    this.bot.use(session());
    this.bot.use(stage.middleware());

    // User tracking middleware
    this.bot.use(async (ctx, next) => {
      if (ctx.from) {
        try {
          await prisma.user.upsert({
            where: { tgId: ctx.from.id.toString() },
            update: { tg_username: ctx.from.username || undefined },
            create: {
              tgId: ctx.from.id.toString(),
              tg_username: ctx.from.username || undefined
            }
          });
        } catch (error) {
          console.error('Error saving user:', error);
        }
      }
      return next();
    });
  }

  /**
   * Sets up callback query handlers for inline buttons
   */
  private setupCallbackQueries(): void {
    // Handle pagination for product listings
    this.bot.action(/^page_products:(\d+)$/, async (ctx) => {
      const page = parseInt(ctx.match[1]);
      await this.showUserProducts(ctx, page);
    });

    // Handle product category browsing
    this.bot.action(/^browse_category:(.+):(\d+)$/, async (ctx) => {
      const categoryId = ctx.match[1];
      const page = parseInt(ctx.match[2]);
      await this.showCategoryProducts(ctx, categoryId, page);
    });

    // Handle adding new products
    this.bot.action('add_product', (ctx) => {
      return ctx.scene.enter('add_product');
    });

    // Handle viewing user's products
    this.bot.action('view_my_products', async (ctx) => {
      await this.showUserProducts(ctx, 1);
    });
    
  }

  /**
   * Sets up bot commands
   */
  private setupCommands(): void {
    // Start command with main menu
    this.bot.command('start', async (ctx) => {
      await ctx.reply(
        '👋 Welcome to the Trading Bot!\n\nWhat would you like to do?',
        Markup.inlineKeyboard([
          [Markup.button.callback('📦 Add New Product', 'add_product')],
          [Markup.button.callback('🔍 Browse Products', 'browse_categories')],
          [Markup.button.callback('📋 My Products', 'view_my_products')]
        ])
      );
    });

    // Add product command
    this.bot.command('addproduct', (ctx) => {
      return ctx.scene.enter('add_product');
    });

    // Browse categories command
    this.bot.command('categories', async (ctx) => {
      await this.showCategories(ctx);
    });

    // My products command
    this.bot.command('myproducts', async (ctx) => {
      await this.showUserProducts(ctx, 1);
    });
  }

  /**
   * Shows available categories with product counts
   */
  
  private async showCategories(ctx: ICustomContext): Promise<void> {
    const categories = await prisma.category.findMany({
      include: {
        _count: {
          select: { products: true }
        }
      }
    });

    const buttons: InlineKeyboardButton[][] = categories.map(cat => ([
      Markup.button.callback(
        `📁 ${cat.name} (${cat._count?.products || 0})`,
        `browse_category:${cat.id}:1`
      )
    ]));

    await ctx.reply(
      '📂 Browse Categories:',
      Markup.inlineKeyboard([
        ...buttons,
        [Markup.button.callback('🏠 Main Menu', 'start')]
      ])
    );
  }

  /**
   * Shows products in a specific category with pagination
   */
  private async showCategoryProducts(
    ctx: ICustomContext,
    categoryId: string,
    page: number
  ): Promise<void> {
    const skip = (page - 1) * this.ITEMS_PER_PAGE;
    
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: {
          categoryId,
          isTraded: false
        },
        include: {
          category: true
        },
        take: this.ITEMS_PER_PAGE,
        skip,
      }),
      prisma.product.count({
        where: {
          categoryId,
          isTraded: false
        }
      })
    ]);

    if (products.length === 0) {
      await ctx.reply(
        '❌ No products found in this category.',
        Markup.inlineKeyboard([[
          Markup.button.callback('◀️ Back to Categories', 'browse_categories')
        ]])
      );
      return;
    }

    const productList = products.map(this.formatProductDetails).join('\n\n');
    const totalPages = Math.ceil(total / this.ITEMS_PER_PAGE);

    const paginationButtons = this.createPaginationButtons(
      page,
      totalPages,
      `browse_category:${categoryId}`
    );

    await ctx.reply(
      `📦 Products in ${products[0].category.name}:\n\n${productList}`,
      Markup.inlineKeyboard([
        ...paginationButtons,
        [Markup.button.callback('◀️ Back to Categories', 'browse_categories')]
      ])
    );
  }

  /**
   * Shows user's products with pagination
   */
  private async showUserProducts(ctx: ICustomContext, page: number): Promise<void> {
    if (!ctx.from) return;

    const skip = (page - 1) * this.ITEMS_PER_PAGE;
    
    const [user, total] = await Promise.all([
      prisma.user.findUnique({
        where: { tgId: ctx.from.id.toString() },
        include: {
          products: {
            where: { isTraded: false },
            include: { category: true },
            take: this.ITEMS_PER_PAGE,
            skip,
          }
        }
      }),
      prisma.product.count({
        where: {
          user: { tgId: ctx.from.id.toString() },
          isTraded: false
        }
      })
    ]);

    if (!user || user.products.length === 0) {
      await ctx.reply(
        '❌ You haven\'t listed any products yet.',
        Markup.inlineKeyboard([[
          Markup.button.callback('📦 Add Product', 'add_product')
        ]])
      );
      return;
    }

    const productList = user.products.map(this.formatProductDetails).join('\n\n');
    const totalPages = Math.ceil(total / this.ITEMS_PER_PAGE);

    const paginationButtons = this.createPaginationButtons(
      page,
      totalPages,
      'page_products'
    );

    await ctx.reply(
      `📋 Your Listed Products:\n\n${productList}`,
      Markup.inlineKeyboard([
        ...paginationButtons,
        [Markup.button.callback('📦 Add New Product', 'add_product')]
      ])
    );
  }

  /**
   * Creates pagination buttons for product listings
   */
  private createPaginationButtons(
    currentPage: number,
    totalPages: number,
    callbackPrefix: string
  ): InlineKeyboardButton[][] {
    const buttons: InlineKeyboardButton[] = [];
    
    if (currentPage > 1) {
      buttons.push(
        Markup.button.callback(
          '◀️ Previous',
          `${callbackPrefix}:${currentPage - 1}`
        )
      );
    }
    
    if (currentPage < totalPages) {
      buttons.push(
        Markup.button.callback(
          'Next ▶️',
          `${callbackPrefix}:${currentPage + 1}`
        )
      );
    }

    return buttons.length > 0 ? [buttons] : [];
  }

  /**
   * Formats product details for display
   */
  private formatProductDetails(product: IProduct): string {
    return [
      `🏷 Title: ${product.title}`,
      `📁 Category: ${product.category.name}`,
      `💭 Wanted: ${product.wanted_trades}`,
      product.created_at ? 
        `📅 Listed: ${product.created_at.toLocaleDateString()}` : 
        ''
    ].filter(Boolean).join('\n');
  }

  /**
   * Starts the bot
   */

  public start(): void {
    this.bot.launch();
    console.log(' Bot started');

    // Enable graceful stop
    process.once('SIGINT', () => {
      this.bot.stop('SIGINT');
      prisma.$disconnect();
    });
    process.once('SIGTERM', () => {
      this.bot.stop('SIGTERM');
      prisma.$disconnect();
    });
  }
}