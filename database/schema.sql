BEGIN;
CREATE TABLE IF NOT EXISTS vehicles (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 name varchar(120) NOT NULL UNIQUE, category varchar(50) NOT NULL,
 passenger_capacity integer CHECK (passenger_capacity > 0),
 air_conditioning boolean, luggage_info varchar(200), description text NOT NULL,
 image_path varchar(250) NOT NULL, video_path varchar(250), is_active boolean NOT NULL DEFAULT true,
 is_sample boolean NOT NULL DEFAULT true,
 availability_status varchar(20) NOT NULL DEFAULT 'unconfirmed' CHECK (availability_status IN ('unconfirmed','available','unavailable')),
 display_order integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bookings (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 booking_reference varchar(50) NOT NULL UNIQUE,
 customer_name varchar(100) NOT NULL, mobile_number varchar(25) NOT NULL, email varchar(254),
 pickup_location varchar(200) NOT NULL, destination varchar(200) NOT NULL,
 journey_date date NOT NULL, pickup_time time NOT NULL,
 vehicle_id integer NOT NULL REFERENCES vehicles(id),
 passenger_count integer NOT NULL CHECK (passenger_count BETWEEN 1 AND 500),
 trip_type varchar(20) NOT NULL CHECK (trip_type IN ('one_way','round_trip','local','outstation','airport')),
 additional_requirements varchar(2000) NOT NULL DEFAULT '', journey_estimate jsonb,
 booking_status varchar(20) NOT NULL DEFAULT 'pending' CHECK (booking_status IN ('pending','confirmed','cancelled','completed')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS contact_enquiries (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 customer_name varchar(100) NOT NULL, mobile_number varchar(25) NOT NULL, email varchar(254),
 subject varchar(150) NOT NULL, message varchar(3000) NOT NULL,
 enquiry_status varchar(20) NOT NULL DEFAULT 'new' CHECK (enquiry_status IN ('new','reviewed','closed')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bookings_journey_date_idx ON bookings(journey_date);
CREATE INDEX IF NOT EXISTS bookings_status_created_idx ON bookings(booking_status,created_at DESC);
CREATE INDEX IF NOT EXISTS bookings_vehicle_idx ON bookings(vehicle_id);
CREATE INDEX IF NOT EXISTS contact_status_created_idx ON contact_enquiries(enquiry_status,created_at DESC);
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE OR REPLACE TRIGGER vehicles_updated BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE OR REPLACE TRIGGER bookings_updated BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
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
COMMIT;
