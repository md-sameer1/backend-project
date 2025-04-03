import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
  // take req from user || get details from frontend
  // validation - not empty
  // check if user already exists : username, email
  // check if username,email, password, fullName and avatar exist
  // check for images , check for avatar
  // upload them to cloudinary, avatar
  // create a user object inside db - create entry in db
  // remove password and refreshToken field from response
  // check for user creation
  // return response

  const { fullName, email, username, password } = req.body;
  //   console.log("email: ", email);

  //   if (fullName === "") {
  //     throw new ApiError(400, "Fullname is required");
  //   }

  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email of username already exist");
  }

  console.log("request.files: ", req.files);
  //   console.log("reques.body: ", req.body);

  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

  //   let coverImageLocalPath;
  //   if (
  //     req.files &&
  //     Array.isArray(req.files.coverImage) &&
  //     req.files.coverImage.length > 0
  //   ) {
  //     coverImageLocalPath = req.files?.coverImage[0]?.path;
  //   }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const userCreated = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!userCreated) {
    throw new ApiError(500, "Something went wrong while registering a user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, userCreated, "User Registered Successfully"));
});

export { registerUser };
