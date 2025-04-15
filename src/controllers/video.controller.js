import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  deleteFromCloudinary,
  uploadOnCloudinary,
} from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;

  const pipeline = [];

  if (query) {
    pipeline.push({
      $search: {
        index: "search-videos",
        text: {
          query: query,
          path: ["title", "description"], //search only on title, desc
        },
      },
    });
  }

  if (userId) {
    if (!isValidObjectId(userId)) {
      throw new ApiError(400, "Invalid user id");
    }
    pipeline.push({
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    });
  }

  pipeline.push({
    $match: {
      isPublished: true,
    },
  });

  if (sortBy && sortType) {
    pipeline.push({
      $sort: {
        [sortBy]: sortType === "asc" ? 1 : -1,
      },
    });
  } else {
    pipeline.push({ $sort: { createdAt: -1 } });
  }

  pipeline.push(
    {
      $lookup: {
        from: "users",
        localField: "_id",
        as: "ownerDetails",
        pipeline: [
          {
            $project: {
              username: 1,
              avatar: 1, // if anything breaks here in future check this link : https://github.com/Hruthik-28/youtube-twitter/blob/main/src/controllers/video.controller.js#L15
            },
          },
        ],
      },
    },
    {
      $unwind: "$ownerDetails",
    }
  );

  const videoAggregate = await Video.aggregate(pipeline);

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  };

  const video = await Video.aggregatePaginate(videoAggregate, options);

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Videos fetched successfully"));
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description, isPublished } = req.body;

  if ([title, description].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "Title and description is required");
  }

  const thumbnailFileLocalPath = req.files?.thumbnail[0]?.path;
  const videoFileLocalPath = req.files?.video[0]?.path;

  if (!thumbnailFileLocalPath) {
    throw new ApiError(400, "Thumbnail file is required");
  }

  if (!videoFileLocalPath) {
    throw new ApiError(400, "Video file is required");
  }

  const thumbnail = await uploadOnCloudinary(thumbnailFileLocalPath);

  if (!thumbnail?.url) {
    throw new ApiError(
      500,
      "Somenthing went wrong while uploding thumbnail to cloudinary"
    );
  }

  const videoFile = await uploadOnCloudinary(videoFileLocalPath);

  if (!videoFile?.url) {
    throw new ApiError(
      500,
      "Somenthing went wrong while uploding video to cloudinary"
    );
  }

  const video = await Video.create({
    title,
    description,
    thumbnail: {
      public_id: thumbnail?.public_id,
      url: thumbnail?.url,
    },
    videoFile: {
      public_id: videoFile?.public_id,
      url: videoFile?.url,
    },
    isPublished,
    duration: videoFile?.duration,
    owner: req?.user?._id,
  });

  if (!video) {
    throw new ApiError(500, "Something went wrong while creating video");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, video, "Video created successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  // get video by id
  // validation of video id
  // aggrigate video data from mongodb using checks like $match : _id and $match : isPublished
  // aggrigation of likes
  // aggrigation of comments -> its users
  // aggrigation of video owner and it's subscription info

  if (!videoId) {
    throw new ApiError(404, "Video id not found");
  }

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Video id is not valid");
  }

  const video = await Video.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $match: {
        isPublished: true,
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
      },
    },
    {
      $lookup: {
        from: "comments",
        localField: "_id",
        foreignField: "video",
        as: "comments",
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
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $lookup: {
              from: "subscriptions",
              localField: "_id",
              foreignField: "channel",
              as: "subscribers",
            },
          },
          {
            $addFields: {
              subscribersCount: {
                $size: "$subscribers",
              },
              isSubscribed: {
                $cond: {
                  if: {
                    $in: [req.user?._id, "$subscribers.subscriber"],
                  },
                  then: true,
                  else: false,
                },
              },
            },
          },
          {
            $project: {
              fullName: 1,
              avatar: 1,
              subscribersCount: 1,
              isSubscribed: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        likesCount: {
          $size: "$likes",
        },
        isLiked: {
          $cond: {
            if: {
              $in: [req?.user?._id, "$likes.likedBy"],
              then: true,
              else: false,
            },
          },
        },
        owner: {
          $first: "$owner",
        },
      },
    },
    {
      $project: {
        videoFile: 1,
        thumbnail: 1,
        title: 1,
        description: 1,
        likesCount: 1,
        isLiked: 1,
        views: 1,
        owner: 1,
        createdAt: 1,
        duration: 1,
        comments: 1,
        isPublished: 1,
      },
    },
  ]);

  console.log("Video by id", video);

  await Video.findByIdAndUpdate(
    videoId,
    {
      $in: {
        views: 1,
      },
    },
    { new: true }
  );

  await User.findByIdAndUpdate(
    req.user?._id,
    {
      $addToSet: {
        watchHistory: videoId,
      },
    },
    { new: true }
  );

  if (!video?.length > 0) {
    throw new ApiError(404, "Video not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video fetched successfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description } = req.body;

  const thumbnailFileLocalPath = req.file?.path;

  if (!videoId) {
    throw new ApiError(400, "vidoe id is required");
  }

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  if (!thumbnailFileLocalPath) {
    throw new ApiError(400, "thumbnail is required");
  }

  if (!(title || description)) {
    throw new ApiError(400, "title and description is required");
  }

  const video = await Video.findById(videoId).select(
    "thumbnail?.public_id owner"
  );

  if (video?.owner?.tostring() !== req?.user?._id) {
    throw new ApiError(403, "You are not allowed to update this video");
  }

  const oldThumbnailPublicId = video?.thumbnail?.public_id;

  const newThumbnail = await uploadOnCloudinary(thumbnailFileLocalPath);

  if (!newThumbnail?.url) {
    throw new ApiError(
      500,
      "Something went wrong while uploading thumbnail on cloudinary"
    );
  }

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        title,
        description,
        thumbnail: {
          public_id: newThumbnail?.public_id,
          url: newThumbnail?.url,
        },
      },
    },
    { new: true }
  );

  if (!updateVideo) {
    throw new ApiError(500, "Something went wrong while updating the video");
  }

  await deleteFromCloudinary(oldThumbnailPublicId);

  return res
    .status(200)
    .json(new ApiResponse(200, updatedVideo, "Video updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    throw new ApiError(400, "Video id is required");
  }

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid Video id");
  }

  const video = Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "video not found");
  }

  if (video?.owner?.toString() !== req?.user?._id.toString()) {
    throw new ApiError(403, "You are not authorized to delete this video");
  }

  const thumbnailPublicId = video?.thumbnail?.public_id;
  const videoPublicId = video?.videoFile?.public_id;

  const deleteVideo = await Video.findByIdAndDelete(videoId);

  if (!deleteVideo) {
    throw new ApiError(500, "Something went wrong while deleting video");
  }

  await deleteFromCloudinary(thumbnailPublicId, "image");
  await deleteFromCloudinary(videoPublicId, "video");

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    throw new ApiError(400, "Video id is required");
  }

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid Video id");
  }

  const video = Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "video not found");
  }

  if (video?.owner?.toString() !== req?.user?._id.toString()) {
    throw new ApiError(403, "You are not authorized to delete this video");
  }

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        isPublished: !video?.isPublished,
      },
    },
    { new: true }
  );

  if (!published) {
    throw new ApiError(500, "Something went wron while publishing");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updateVideo, "Video published successfully"));
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
