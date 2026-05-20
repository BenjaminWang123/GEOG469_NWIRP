const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No image uploaded"
      });
    }

    const ext = req.file.originalname.split(".").pop();

    const fileName = `${Date.now()}-${crypto.randomUUID()}.${ext}`;

    console.log("Uploading:", fileName);

    const { error } = await supabase.storage
      .from("report-images")
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (error) {
      console.error(error);
      throw error;
    }

    const { data } = supabase.storage
      .from("report-images")
      .getPublicUrl(fileName);

    return res.json({
      success: true,
      image_url: data.publicUrl
    });

  } catch (err) {
    console.error("UPLOAD FAILED:", err);

    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};