import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.body;

  if (!videoId) {
    throw new ApiError(400, "Video id is required");
  }

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  const isLiked = await Like.findOne({
    video: videoId,
    likedBy: req?.user?._id,
  });

  if (!isLiked) {
    const likeCreated = await Like.create({
      video: videoId,
      likedBy: req?.user?._id,
    });

    if (!likeCreated) {
      throw new ApiError(500, "Something went wrong while adding a like!");
    }

    return res.status(200).json(new ApiResponse(200, {}, "Liked successfully"));
  } else {
    const likeDeleted = await Like.findByIdAndDelete(isLiked?._id);

    if (!likeDeleted) {
      throw new ApiError(500, "Something went wrong while removing the like");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Like removed Successfully"));
  }
});

const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.body;

  if (!commentId) {
    throw new ApiError(400, "Comment id is required");
  }

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid Comment id");
  }

  const isCommentLiked = await Like.findOne({
    comment: commentId,
    likedBy: req?.user?._id,
  });

  if (!isCommentLiked) {
    const commentLikeCreated = await Like.create({
      comment: commentId,
      likedBy: req?.user?._id,
    });

    if (!commentLikeCreated) {
      throw new ApiError(
        500,
        "Something went wrong while adding a like to this comment!"
      );
    }

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Comment liked successfully!"));
  } else {
    const commentLikeDeleted = await Like.findByIdAndDelete(
      isCommentLiked?._id
    );

    if (!commentLikeDeleted) {
      throw new ApiError(500, "Something went wrong while removing the like");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Comment unliked successfully"));
  }
});

const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.body;
  if (!tweetId) {
    throw new ApiError(400, "tweet id is required");
  }

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweet id");
  }

  const tweetLiked = await Like.findOne({
    tweet: tweetId,
    likedBy: req?.user?._id,
  });

  if (!tweetLiked) {
    const tweetLikeCreated = await Like.create({
      tweetId: tweetId,
      likedBy: req?.user?._id,
    });

    if (!tweetLikeCreated) {
      throw new ApiError(500, "Something went wrong while liking the tweet");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Tweet liked successfully"));
  } else {
    const tweetLikeDeleted = await Like.findByIdAndDelete(tweetLiked?._id);

    if (!tweetLikeDeleted) {
      throw new ApiError(500, "Something went wrong while Unliking the tweet");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Tweet unliked Successfully"));
  }
});

const getLikedVideos = asyncHandler(async (req, res) => {
  const likedVideos = Like.aggregate([
    {
      $match: {
        likedBy: mongoose.Types.ObjectId(req?.user?._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "likedVideos",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
      $project: {
        _id: 0,
        likedVideos: {
          thumbnail: 1,
          title: 1,
          description: 1,
          duration: 1,
          views: 1,
          owner: 1,
          createdAt: 1,
        },
      },
    },
  ]);

  if (!likedVideos?.lenght) {
    throw new ApiError(new ApiError(404, "No liked videos found"));
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, likedVideos, "Liked videos fetched successfully")
    );
});

export { toggleCommentLike, toggleTweetLike, toggleVideoLike, getLikedVideos };
