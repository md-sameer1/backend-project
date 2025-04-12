import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  //TODO: get all videos based on query, sort, pagination

  const pipeline = [];

  //for using text based search you need to create a search index in mongoDB atlas
  // you can include field mapppings in search index eg.title, description, as well
  // Field mappings specify which fields within your documents should be indexed for text search.
  // this helps in seraching only in title, desc providing faster search results
  // here the name of search index is 'search-videos'

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
  // TODO: title, description
  // validate it
  // TODO: get video and thumbnail
  // validate it
  // TODO: upload them to cloudinary,
  // TODO: create video
  // upload to db
  // send res

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
    thumbnail: thumbnail?.url,
    videoFile: videoFile?.url,
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

  await Video.findByIdAndUpdate(videoId, {
    $in: {
      views: 1,
    },
  });

  await User.findByIdAndUpdate(req.user?._id, {
    $addToSet: {
      watchHistory: videoId,
    },
  });

  if (!video?.length > 0) {
    throw new ApiError(404, "Video not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video fetched successfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: update video details like title, description, thumbnail
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: delete video
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
