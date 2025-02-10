/*
  # Initial Project Management Schema

  1. New Tables
    - `clients`
      - `id` (uuid, primary key)
      - `name` (text)
      - `company_name` (text)
      - `email` (text)
      - `phone` (text)
      - `billing_address` (text)
      - `payment_terms` (text)
      - `created_at` (timestamp)
    
    - `projects`
      - `id` (uuid, primary key)
      - `name` (text)
      - `client_id` (uuid, foreign key)
      - `status` (text)
      - `created_at` (timestamp)
    
    - `team_members`
      - `id` (uuid, primary key)
      - `name` (text)
      - `email` (text)
      - `role` (text)
      - `hourly_rate` (decimal)
      - `created_at` (timestamp)
    
    - `project_members`
      - `id` (uuid, primary key)
      - `project_id` (uuid, foreign key)
      - `team_member_id` (uuid, foreign key)
      - `created_at` (timestamp)
    
    - `activities`
      - `id` (uuid, primary key)
      - `project_id` (uuid, foreign key)
      - `team_member_id` (uuid, foreign key)
      - `activity_description` (text)
      - `duration` (interval)
      - `upwork_hours` (decimal)
      - `total_amount` (decimal)
      - `created_at` (timestamp)
    
    - `orders`
      - `id` (uuid, primary key)
      - `client_id` (uuid, foreign key)
      - `project_id` (uuid, foreign key)
      - `order_number` (text)
      - `invoice_date` (date)
      - `total_hours` (decimal)
      - `total_amount` (decimal)
      - `status` (text)
      - `created_at` (timestamp)
    
    - `payments`
      - `id` (uuid, primary key)
      - `order_id` (uuid, foreign key)
      - `amount_paid` (decimal)
      - `payment_date` (date)
      - `payment_status` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Clients table
CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company_name text,
  email text NOT NULL,
  phone text,
  billing_address text,
  payment_terms text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read clients"
  ON clients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (true);

-- Projects table
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  client_id uuid REFERENCES clients(id),
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('active', 'completed'))
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read projects"
  ON projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (true);

-- Team Members table
CREATE TABLE team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL,
  hourly_rate decimal NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read team members"
  ON team_members FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert team members"
  ON team_members FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update team members"
  ON team_members FOR UPDATE
  TO authenticated
  USING (true);

-- Project Members table (junction table for projects and team members)
CREATE TABLE project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id),
  team_member_id uuid REFERENCES team_members(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, team_member_id)
);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read project members"
  ON project_members FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert project members"
  ON project_members FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Activities table
CREATE TABLE activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id),
  team_member_id uuid REFERENCES team_members(id),
  activity_description text NOT NULL,
  duration interval NOT NULL,
  upwork_hours decimal NOT NULL DEFAULT 0,
  total_amount decimal NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read activities"
  ON activities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert activities"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update activities"
  ON activities FOR UPDATE
  TO authenticated
  USING (true);

-- Orders table
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id),
  project_id uuid REFERENCES projects(id),
  order_number text NOT NULL UNIQUE,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  total_hours decimal NOT NULL DEFAULT 0,
  total_amount decimal NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('paid', 'pending'))
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read orders"
  ON orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (true);

-- Payments table
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id),
  amount_paid decimal NOT NULL DEFAULT 0,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_payment_status CHECK (payment_status IN ('completed', 'pending'))
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read payments"
  ON payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update payments"
  ON payments FOR UPDATE
  TO authenticated
  USING (true);

-- Create indexes for better query performance
CREATE INDEX idx_projects_client_id ON projects(client_id);
CREATE INDEX idx_project_members_project_id ON project_members(project_id);
CREATE INDEX idx_project_members_team_member_id ON project_members(team_member_id);
CREATE INDEX idx_activities_project_id ON activities(project_id);
CREATE INDEX idx_activities_team_member_id ON activities(team_member_id);
CREATE INDEX idx_orders_client_id ON orders(client_id);
CREATE INDEX idx_orders_project_id ON orders(project_id);
CREATE INDEX idx_payments_order_id ON payments(order_id);