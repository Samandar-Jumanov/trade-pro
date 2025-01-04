import type { Request, RequestHandler, Response } from "express";

import { userService } from "@/api/user/userService";
import { handleServiceResponse } from "@/common/utils/httpHandlers";

class UserController {
  public createUser: RequestHandler = async (req: Request, res: Response) => {
    const user = req.body;
    const serviceResponse = await userService.createUser(user);
    return handleServiceResponse(serviceResponse, res);
  };
}

export const userController = new UserController();
