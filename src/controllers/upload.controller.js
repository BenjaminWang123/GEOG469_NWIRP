const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.uploadImage = async (req, res) => {

  try {

    if (!req.file) {
      return res.status(400).json({
        error: "No image uploaded"
      });
    }

    const fileName = `${Date.now()}-${req.file.originalname}`;

    const { error } = await supabase.storage
      .from("report-images")
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype
      });

    if (error) throw error;

    const { data } = supabase.storage
      .from("report-images")
      .getPublicUrl(fileName);

    res.json({
      success: true,
      image_url: data.publicUrl
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Image upload failed"
    });

  }

};