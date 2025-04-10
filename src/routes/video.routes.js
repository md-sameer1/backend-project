import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { getAllVideos } from "../controllers/video.controller.js";

const router = Router();

router.use(verifyJWT);

router.route("/get-all-Videos").get(getAllVideos);

export default router;
