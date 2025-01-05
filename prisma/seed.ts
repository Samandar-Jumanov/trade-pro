import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Clean up existing data
  await prisma.trade.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  // Create categories
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        name: 'Electronics',
        type: 'physical',
      },
    }),
    prisma.category.create({
      data: {
        name: 'Books',
        type: 'physical',
      },
    }),
    prisma.category.create({
      data: {
        name: 'Clothing',
        type: 'physical',
      },
    }),
    prisma.category.create({
      data: {
        name: 'Services',
        type: 'digital',
      },
    }),
    prisma.category.create({
      data: {
        name: 'Gaming',
        type: 'digital',
      },
    }),
  ]);

  // Create users with realistic Telegram IDs
  const users = await Promise.all([
    prisma.user.create({
      data: {
        tgId: '123456789',
        tg_username: 'john_doe',
      },
    }),
    prisma.user.create({
      data: {
        tgId: '987654321',
        tg_username: 'jane_smith',
      },
    }),
    prisma.user.create({
      data: {
        tgId: '456789123',
        tg_username: 'trading_pro',
      },
    }),
    prisma.user.create({
      data: {
        tgId: '789123456',
        tg_username: 'tech_trader',
      },
    }),
  ]);

  // Create products for each user
  const products = [];
  for (const user of users) {
    const userProducts = await Promise.all([
      prisma.product.create({
        data: {
          title: `iPhone 13 Pro`,
          wanted_trades: 'Looking for MacBook or gaming laptop',
          userId: user.id,
          categoryId: categories[0].id, // Electronics
          isTraded: false,
        },
      }),
      prisma.product.create({
        data: {
          title: 'Programming Books Bundle',
          wanted_trades: 'Want fitness equipment or tech gadgets',
          userId: user.id,
          categoryId: categories[1].id, // Books
          isTraded: false,
        },
      }),
      prisma.product.create({
        data: {
          title: 'Nike Air Max (New)',
          wanted_trades: 'Looking for other branded shoes or watch',
          userId: user.id,
          categoryId: categories[2].id, // Clothing
          isTraded: false,
        },
      }),
    ]);
    products.push(...userProducts);
  }

  // Create some trades for random products
  const tradedProducts = products.slice(0, 3); // Take first 3 products for trades
  await Promise.all(
    tradedProducts.map(async (product) => {
      const trade = await prisma.trade.create({
        data: {
          id: undefined, // Let Prisma generate the ID
        },
      });

      await prisma.product.update({
        where: { id: product.id },
        data: {
          isTraded: true,
          tradeId: trade.id,
        },
      });
    })
  );

  console.log({
    categories: await prisma.category.count(),
    users: await prisma.user.count(),
    products: await prisma.product.count(),
    trades: await prisma.trade.count(),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });