import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Router } from "express";
import { z } from "zod";

import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import {  UserCreateSchema, UserSchema } from "@/api/user/userModel";
import { validateRequest } from "@/common/utils/httpHandlers";
import { userController } from "./userController";

export const userRegistry = new OpenAPIRegistry();
export const userRouter: Router = express.Router();

userRegistry.register("User", UserSchema);

userRegistry.registerPath({
  method: "post",
  path: "/users",
  tags: ["User"],
  request : {
    body: {
      content: {
        'application/json': {
          schema: UserCreateSchema
        }
      }
    }
  },
  responses: createApiResponse(z.any(UserSchema), "Success"),
});



userRouter.post("/", validateRequest(z.object({
     body : UserCreateSchema
})), userController.createUser);



