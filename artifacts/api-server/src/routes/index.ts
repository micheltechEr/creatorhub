import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import artistsRouter from "./artists";
import ordersRouter from "./orders";
import paymentsRouter from "./payments";
import mediaRouter from "./media";
import reviewsRouter from "./reviews";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(artistsRouter);
router.use(ordersRouter);
router.use(paymentsRouter);
router.use(mediaRouter);
router.use(reviewsRouter);
router.use(dashboardRouter);

export default router;
