import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

const connectDB = async () => {
  let mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    const mem = await MongoMemoryServer.create();
    mongoUri = mem.getUri();
    console.warn("MONGO_URI not set; using in-memory MongoDB for local development.");
  }

  await mongoose.connect(mongoUri);
  console.log("MongoDB Connected");
};

export default connectDB;