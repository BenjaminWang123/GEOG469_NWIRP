CREATE TABLE "tblImpactReports" (

    id SERIAL PRIMARY KEY,

    category TEXT,
    event_date DATE,
    county TEXT,
    description TEXT,
    email TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);