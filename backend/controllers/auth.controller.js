import bcryptjs from "bcryptjs";
import crypto from "crypto";

import { generateTokenAndSetCookie } from "../utils/generateTokenAndSetCookie.js";
import { sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail, sendResetSuccessEmail } from "../mailtrap/emails.js";
import { User } from "../models/user.model.js";

export const signup = async (req, res) => {
  const { email, password, name } = req.body;
  try {
    if (!email || !password || !name) {
      throw new Error("All fields are required");
    }

    const userAlreadyExists = await User.findOne({ email });
    console.log("userAlreadyExists", userAlreadyExists);
    if (userAlreadyExists) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);
    const verificationToken = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    const user = new User({
      email,
      password: hashedPassword,
      name,
      verificationToken,
      verificationTokenExpiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });

    await user.save();

    // jwt
    generateTokenAndSetCookie(res, user._id);

    await sendVerificationEmail(user.email, verificationToken);

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user: {
        ...user._doc,
        password: undefined,
      },
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const verifyEmail = async (req, res) => {
  const {code} = req.body;
  try{
    const user = await User.findOne({
      verificationToken: code,
      verificationTokenExpiresAt: {$gt: Date.now()}
    })

    if(!user){
      return res.status(400).json({success: false, message: "Invalid or expired verification code"})
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiresAt = undefined;
    await user.save();

    await sendWelcomeEmail(user.email, user.name);

    res.status(200).json({
      success: true,
      message: "Email verified successfully",
      user:{
        ...user._doc,
        password: undefined,
      },
    })

  } catch (error) {
    console.log("error in verifyEmail ", error);
    res.status(500).json({success: false, message: "Server error"});
  }
}

export const login = async (req, res) => {
  // body se hme email or password milta hai.
  const {email, password} = req.body;
  try{
    // we search email in database
    const user = await User.findOne({email});
    // if we do not find the email in the database, return error
    if(!user){
      return res.status(400).json({success: false, message: "Invalid credentials"});
    }
    // if we find the email in the database, we verify the password
    const isPasswordValid = await bcryptjs.compare(password, user.password);
    // if the password is not matched correctly. return error
    if(!isPasswordValid) {
      return res.status(400).json({success: false, message: "Invalid credentials"});
    }
    // if password is correct , we generate a token

    generateTokenAndSetCookie(res, user._id);

    // we update the last login date
     user.lastLogin = new Date();

     // save the user to the database with lastlogin update
     await user.save();

     // after i save the user, i will get a response back by removing the password

     res.status(200).json({
      success: true,
      message: "Logged in successfully",
      user: {
        ...user._doc,
        password: undefined,
      },
     });



  }catch (error){
    // if i do not write email and password or leave empty
    console.log("Error in login ", error);
    res.status(400).json({success: false, message: error.message});

  }
};

export const logout = async (req, res) => {
  res.clearCookie("token");
  res.status(200).json({success: true, message: "Logged out successfully"});
};


export const forgotPassword = async (req, res) => {
  // first we get the email
  const {email} = req.body;
  try{
    // check email in the database
    const user = await User.findOne({email});
    // if email is not found in the database
    if(!user){
      return res.status(400).json({success: false, message:"User not found"});
    }
    // if email is found, reset token is generated
    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString("hex");
    const resetTokenExpiresAt = Date.now() + 1* 60 * 60 * 1000; //1 hour

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiresAt = resetTokenExpiresAt;

    await user.save();

    //send email to rest password link
    await sendPasswordResetEmail(user.email, `${process.env.CLIENT_URL}/reset-password/${resetToken}`);
    res.status(200).json({success: true, message: "Password reset link sent to your email"});
  }catch (error){
    console.log("Error in forgotPassword", error);
    res.status(400).json({success: false, message: error.message});

  }
}

export  const resetPassword = async (req, res) => {
  try{
    const {token} = req.params;
    const {password} = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpiresAt: {$gt: Date.now()},
    });

    if(!user){
      return res.status(400).json({success: false, message: "Invalid or expired reset token"});
    }

    // update password
    const hashedPassword = await bcryptjs.hash(password, 10);

    user.password = hashedPassword;

    // we update the password so we delete the resetpasswordtoken and resetpasswordexpiresat
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiresAt = undefined;

    // save the user to the database

    await user.save();

    // after succesfully reset the password, send an email to the recipient of successfully reset the password
    
    await sendResetSuccessEmail(user.email);

    res.status(200).json({success: true, message: "Password reset successful"});

  } catch (error){
    console.log("Error in resetPassword ", error);
    res.status(400).json({success: false, message: error.message});

  }

}