import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  getAllVideos,
  publishAVideo,
} from "../controllers/video.controller.js";

const router = Router();

router.use(verifyJWT);

router.route("/get-all-Videos").get(getAllVideos);

router.route("/publish-video").post(publishAVideo);

router.route("/get-video/:videoId");

export default router;
