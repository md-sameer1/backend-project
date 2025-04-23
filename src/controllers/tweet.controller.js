import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createTweet = asyncHandler(async (req, res) => {
  const { content } = req?.body;

  if (!content) {
    throw new ApiError(400, "Content is required");
  }

  const tweet = await Tweet.create({
    content,
    owner: req?.user?._id,
  });

  if (!tweet) {
    throw new ApiError(500, "Something went wrong while creating tweet");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, tweet, "Tweet created successfully"));
});

const getUserTweet = asyncHandler(async (req, res) => {
  const { userId } = req?.params;

  if (!userId) {
    throw new ApiError(400, "User id is required");
  }

  if (!isValidObjectId(userId)) {
    throw new ApiError(401, "Invalid user id");
  }

  Tweet.aggregate([
    {
      $match: {
        owner: mongoose.Types.ObjectId(userId),
      },
    },

    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $project: {
              username: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: "$owner",
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
      $project: {
        content: 1,
        owner: 1,
        createdAt: 1,
      },
    },
  ]);
});

const updateTweet = asyncHandler(async (req, res) => {
  const { content: newContent } = req?.body;
  const { tweetId } = req?.params;

  if (!tweetId) {
    throw new ApiError(400, "Tweet id is required");
  }
  if (!isValidObjectId(tweetId)) {
    throw new ApiError(401, "Invalid tweet id");
  }
  if (!newContent?.trim()) {
    throw new ApiError(400, "Content is required");
  }

  const updatedTweet = await Tweet.findByIdAndUpdate(
    tweetId,
    {
      $set: {
        content: newContent,
      },
    },
    {
      new: true,
    }
  );

  if (!updatedTweet) {
    throw new ApiError(500, "Something went wrong while updating tweet");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedTweet, "Tweet updated successfully"));
});

const deleteTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req?.params;

  if (!tweetId) {
    throw new ApiError(400, "Tweet id is required");
  }

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweet id");
  }

  const tweet = await Tweet.findById(tweetId);

  if (tweet?.owner.toString() !== req?.user?._id.toString()) {
    throw new ApiError(403, "You are unauthorized to delete this tweet");
  }

  const deletedTweet = await Tweet.findByIdAndDelete(tweetId);

  if (!deleteTweet) {
    throw new ApiError(500, "Something went wrong while deleting tweet");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Tweet deleted successfully"));
});

export { createTweet, getUserTweet, updateTweet, deleteTweet };
