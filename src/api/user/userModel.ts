import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import { commonValidations } from "@/common/utils/commonValidation";

extendZodWithOpenApi(z);

export type UserDto = z.infer<typeof UserSchema>;
export type UserCreateDto = z.infer<typeof UserCreateSchema>;


export const UserSchema = z.object({
  id: z.string(),
  tg_username  : z.string().nullable(),
  tgId       : z.string()
});


export const UserCreateSchema = z.object({
  tg_username  : z.string().optional(),
  tgId       : z.string()
})
// Input Validation for 'GET users/:id' endpoint
export const GetUserSchema = z.object({
  params: z.object({ id: commonValidations.id }),
});
