import { Router } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import accountsRouter from "./accounts";
import scansRouter from "./scans";
import findingsRouter from "./findings";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";

const router = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(accountsRouter);
router.use(scansRouter);
router.use(findingsRouter);
router.use(dashboardRouter);
router.use(reportsRouter);

export default router;
