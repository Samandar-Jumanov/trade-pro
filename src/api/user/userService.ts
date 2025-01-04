import type { UserCreateDto , UserDto } from "@/api/user/userModel";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { logger } from "@/server";
import prisma from "@/lib/prisma";

export class UserService {

  async  createUser (data : UserCreateDto ) : Promise<ServiceResponse<UserDto | null>> {
      try {

        const user = await prisma.user.upsert({
          create: {
              tgId: data.tgId,
              tg_username: data?.tg_username
          },
          update: data,
          where: {
              tgId: data.tgId
          }
      })
       logger.info(`User with tgId ${data.tgId} created successfully`)
        return  ServiceResponse.success("User created successfully" , user , 201)
      } catch (error : any ) {
       logger.info(`User with tgId ${data.tgId} could not be added ${error.message} `)
        return  ServiceResponse.failure("User created successfully"  , null , 500)
      }

  }
}

export const userService = new UserService();
