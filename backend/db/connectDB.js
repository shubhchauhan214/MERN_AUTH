import mongoose from "mongoose";

export const connectDB = async () => {
    try{
        console.log("mongo_uri: ", process.env.MONGO_URI); // ye jo mera error aaya tha uri undefined ka, isse debug kiya hmne
        const conn = await mongoose.connect(process.env.MONGO_URI)
        console.log(`MongoDB Connected: ${conn.connection.host}`)
    } catch (error) {
        console.log("Error connection to MongoDB: ", error.message)
        process.exit(1) // failure, exit with failure, 1 is failure and 0 is success
    }
}