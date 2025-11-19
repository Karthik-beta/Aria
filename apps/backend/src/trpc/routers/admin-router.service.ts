import { Injectable } from '@nestjs/common';
import { adminRouter } from './admin.router';

/**
 * AdminRouter service provides the admin TRPC router
 */
@Injectable()
export class AdminRouter {
  getRouter() {
    return adminRouter;
  }
}
