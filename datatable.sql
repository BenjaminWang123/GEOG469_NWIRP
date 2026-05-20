DROP TABLE IF EXISTS "tblImpactReports";

CREATE TABLE "tblImpactReports" (

    id SERIAL PRIMARY KEY,

    county TEXT NOT NULL,
    incident_type TEXT NOT NULL,
    description TEXT,
    event_date DATE,
    event_time TIME,
    image_url TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);