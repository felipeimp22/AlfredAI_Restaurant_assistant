-----------------------------------------------------------
-- data\db-script.sql
-----------------------------------------------------------
-- ==========================================================
-- INIT SCRIPT FOR RESTAURANT DATABASE AND SUPABASE AUTH SETUP
-- ==========================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-----------------------------------------------------------
-- SECTION 1: Create the Restaurant Schema & Tables
-----------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS restaurant;

-- Set search_path to restaurant, public for app tables
SET search_path TO restaurant, public;

-- Create Menu table
CREATE TABLE dishes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dish VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    category VARCHAR(50) NOT NULL,
    sold INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create Ingredients table
CREATE TABLE ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    quantity DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    reorder_level DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create Dish_Ingredients junction table
CREATE TABLE dish_ingredients (
    dish_id UUID REFERENCES dishes(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id) ON DELETE RESTRICT,
    PRIMARY KEY (dish_id, ingredient_id)
);

-- Create Staff table
CREATE TABLE staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL,
    salary DECIMAL(10, 2) NOT NULL,
    hire_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create Staff_Specialties table
CREATE TABLE staff_specialties (
    staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
    specialty VARCHAR(50) NOT NULL,
    PRIMARY KEY (staff_id, specialty)
);

-- Create Customers table
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(20),
    visits INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create Orders table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    order_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'completed',
    date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create Order_Items table
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    dish_id UUID REFERENCES dishes(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    price_per_unit DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create a function to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic updating
CREATE TRIGGER update_dishes_modtime
BEFORE UPDATE ON dishes
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_ingredients_modtime
BEFORE UPDATE ON ingredients
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_staff_modtime
BEFORE UPDATE ON staff
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_customers_modtime
BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_orders_modtime
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_order_items_modtime
BEFORE UPDATE ON order_items
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Create Views
CREATE VIEW popular_dishes AS
SELECT d.dish, d.category, SUM(oi.quantity) AS total_ordered
FROM dishes d
JOIN order_items oi ON d.id = oi.dish_id
GROUP BY d.dish, d.category
ORDER BY total_ordered DESC;

CREATE VIEW low_stock_ingredients AS
SELECT name, quantity, unit, reorder_level
FROM ingredients
WHERE quantity <= reorder_level;

CREATE VIEW customer_spending AS
SELECT c.name, COUNT(o.id) AS order_count, SUM(o.total_amount) AS total_spent
FROM customers c
JOIN orders o ON c.id = o.customer_id
GROUP BY c.name
ORDER BY total_spent DESC;

-- Comment on schema
COMMENT ON SCHEMA restaurant IS 'Schema for restaurant management system, including menu, staff, customers, and orders';

-----------------------------------------------------------
-- SECTION 2: Create the Supabase Auth Schema & Objects
-----------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS auth;

-- Switch search_path to auth, public for Supabase Auth objects
SET search_path TO auth, public;

-- Create auth.users table
CREATE TABLE IF NOT EXISTS users (
    instance_id uuid NULL,
    id uuid NOT NULL UNIQUE,
    aud varchar(255) NULL,
    "role" varchar(255) NULL,
    email varchar(255) NULL UNIQUE,
    encrypted_password varchar(255) NULL,
    confirmed_at timestamptz NULL,
    invited_at timestamptz NULL,
    confirmation_token varchar(255) NULL,
    confirmation_sent_at timestamptz NULL,
    recovery_token varchar(255) NULL,
    recovery_sent_at timestamptz NULL,
    email_change_token varchar(255) NULL,
    email_change varchar(255) NULL,
    email_change_sent_at timestamptz NULL,
    last_sign_in_at timestamptz NULL,
    raw_app_meta_data jsonb NULL,
    raw_user_meta_data jsonb NULL,
    is_super_admin bool NULL,
    created_at timestamptz NULL,
    updated_at timestamptz NULL,
    CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS users_instance_id_email_idx ON users USING btree (instance_id, email);
CREATE INDEX IF NOT EXISTS users_instance_id_idx ON users USING btree (instance_id);
COMMENT ON TABLE users IS 'Auth: Stores user login data within a secure schema.';

-- Create auth.refresh_tokens table and pre-apply migration changes
CREATE TABLE IF NOT EXISTS refresh_tokens (
    instance_id uuid NULL,
    id bigserial NOT NULL,
    "token" varchar(255) NULL,
    user_id varchar(255) NULL,
    revoked bool NULL,
    created_at timestamptz NULL,
    updated_at timestamptz NULL,
    CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id)
);

-- Manually add the column and constraints that the migration 20210927181326 would add
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS parent varchar(255) NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_schema = 'auth'
          AND table_name = 'refresh_tokens'
          AND constraint_name = 'refresh_tokens_token_unique'
    ) THEN
        ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_tokens_token_unique UNIQUE ("token");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_schema = 'auth'
          AND table_name = 'refresh_tokens'
          AND constraint_name = 'refresh_tokens_parent_fkey'
    ) THEN
        ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_tokens_parent_fkey FOREIGN KEY (parent) REFERENCES refresh_tokens("token");
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS refresh_tokens_parent_idx ON refresh_tokens USING btree (parent);

-- Create auth.instances table
CREATE TABLE IF NOT EXISTS instances (
    id uuid NOT NULL,
    uuid uuid NULL,
    raw_base_config text NULL,
    created_at timestamptz NULL,
    updated_at timestamptz NULL,
    CONSTRAINT instances_pkey PRIMARY KEY (id)
);
COMMENT ON TABLE instances IS 'Auth: Manages users across multiple sites.';

-- Create auth.audit_log_entries table
CREATE TABLE IF NOT EXISTS audit_log_entries (
    instance_id uuid NULL,
    id uuid NOT NULL,
    payload json NULL,
    created_at timestamptz NULL,
    CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS audit_logs_instance_id_idx ON audit_log_entries USING btree (instance_id);
COMMENT ON TABLE audit_log_entries IS 'Auth: Audit trail for user actions.';

-- Create auth.schema_migrations table
CREATE TABLE IF NOT EXISTS schema_migrations (
    "version" varchar(255) NOT NULL,
    CONSTRAINT schema_migrations_pkey PRIMARY KEY ("version")
);
COMMENT ON TABLE schema_migrations IS 'Auth: Manages updates to the auth system.';

-- Create helper functions in auth schema
CREATE OR REPLACE FUNCTION uid() RETURNS uuid AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION role() RETURNS text AS $$
  SELECT nullif(current_setting('request.jwt.claim.role', true), '')::text;
$$ LANGUAGE sql STABLE;

-- Mark the migration "20210927181326" as applied in auth.schema_migrations so it won’t run again
INSERT INTO schema_migrations ("version") VALUES ('20210927181326')
ON CONFLICT ("version") DO NOTHING;

-----------------------------------------------------------
-- SECTION 3: Switch Back to Application Schema
-----------------------------------------------------------
-- Reset search_path to restaurant, public for your application
SET search_path TO restaurant, public;
