import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    //upload the file on cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_typeL: "auto",
    });

    //file has been uploaded successfully

    // console.log("file is uploaded on cloudinary", response.url);
    // console.log("cloudinary response", response);

    fs.unlinkSync(localFilePath);

    return response;
  } catch (error) {
    fs.unlinkSync(localFilePath); // remove the locally saved temp file as the upload operation failed
    return null;
  }
};

const deleteFromCloudinary = async (public_id, resource_type = "image") => {
  try {
    if (!public_id) return null;
    //delete the file from cloudinary
    await cloudinary.uploader.destroy(public_id, {
      resource_type: resource_type,
    });

    //file has been uploaded successfully
  } catch (error) {
    console.log("error while deleting the image from coudinary", error); // remove the locally saved temp file as the upload operation failed
    return null;
  }
};

export { uploadOnCloudinary, deleteFromCloudinary };
