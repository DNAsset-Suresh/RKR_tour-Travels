CREATE TABLE IF NOT EXISTS vehicle_tariffs (
 vehicle_id integer PRIMARY KEY REFERENCES vehicles(id) ON DELETE CASCADE,
 currency char(3) NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
 package_5h_50km integer NOT NULL CHECK (package_5h_50km >= 0),
 package_10h_100km integer NOT NULL CHECK (package_10h_100km >= 0),
 extra_hour integer NOT NULL CHECK (extra_hour >= 0),
 extra_km integer NOT NULL CHECK (extra_km >= 0),
 source_note text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
