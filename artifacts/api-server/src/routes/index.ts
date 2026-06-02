import { Router, type IRouter } from "express";
import healthRouter from "./health";
import artistsRouter from "./artists";
import ordersRouter from "./orders";
import paymentsRouter from "./payments";
import mediaRouter from "./media";
import reviewsRouter from "./reviews";
import dashboardRouter from "./dashboard";
import usersRouter from "./users";
import adminRouter from "./admin";
import clientsRouter from "./clients";
import contractsRouter from "./contracts";
import walletRouter from "./wallet";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(artistsRouter);
router.use(ordersRouter);
router.use(paymentsRouter);
router.use(mediaRouter);
router.use(reviewsRouter);
router.use(dashboardRouter);
router.use("/admin", adminRouter);
router.use(clientsRouter);
router.use(contractsRouter);
router.use(walletRouter);

export default router;
