-- ERP DATABASE SETUP FOR COMPLIANCE TESTING
-- This creates a realistic ERP database with strategic compliance issues

-- CORE ERP TABLES
-- Some tables have RLS, some don't (for testing RLS compliance)

-- Customers table (NO RLS - will fail check)
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  modified_at TIMESTAMPTZ DEFAULT now()
);

-- Products table (WITH RLS - will pass check)
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT UNIQUE,
  price DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2),
  stock_quantity INTEGER DEFAULT 0,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  modified_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all products" 
ON public.products FOR SELECT 
USING (true);

CREATE POLICY "Users can only update their own products" 
ON public.products FOR UPDATE 
USING (auth.uid() = created_by);

-- Orders table (NO RLS - will fail check)
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id),
  order_date TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'pending',
  total_amount DECIMAL(12,2),
  shipping_address TEXT,
  payment_method TEXT,
  notes TEXT
);

-- Order items table (WITH RLS - will pass check)
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  discount DECIMAL(5,2) DEFAULT 0
);

-- Enable RLS on order items
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Order items are viewable by all staff" 
ON public.order_items FOR SELECT 
USING (true);

-- Employees table (sensitive data, NO RLS - critical fail)
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  position TEXT,
  department TEXT,
  salary DECIMAL(12,2),
  hire_date DATE,
  ssn TEXT,  -- Sensitive data
  bank_account TEXT, -- Sensitive data
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert sample data
INSERT INTO public.customers (company_name, contact_name, email, phone)
VALUES 
  ('Acme Corp', 'John Smith', 'john@acme.com', '555-1234'),
  ('Globex Industries', 'Jane Doe', 'jane@globex.com', '555-5678'),
  ('Umbrella Inc', 'Alice Johnson', 'alice@umbrella.com', '555-9012');

-- Products will be inserted after user creation

-- Create some orders
INSERT INTO public.orders (customer_id, status, total_amount)
VALUES 
  ((SELECT id FROM public.customers WHERE company_name = 'Acme Corp'), 'completed', 1250.99),
  ((SELECT id FROM public.customers WHERE company_name = 'Globex Industries'), 'processing', 850.50),
  ((SELECT id FROM public.customers WHERE company_name = 'Umbrella Inc'), 'pending', 2340.00);

-- FOR USERS & MFA TESTING
-- To create actual auth users, you need to:

-- 1. Create a custom SQL function to insert users bypassing auth API:
CREATE OR REPLACE FUNCTION public.create_test_user(
  email TEXT,
  password TEXT DEFAULT 'Password123',
  first_name TEXT DEFAULT NULL,
  last_name TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Insert into auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    email,
    crypt(password, gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    json_build_object('first_name', first_name, 'last_name', last_name),
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  RETURNING id INTO user_id;

  -- Return the created user ID
  RETURN user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create test users and associated product data:
DO $$
DECLARE
  user1_id UUID;
  user2_id UUID;
  user3_id UUID;
BEGIN
  -- Create test users with the function
  user1_id := public.create_test_user('test1@example.com', 'Password123', 'Test', 'User1');
  user2_id := public.create_test_user('test2@example.com', 'Password123', 'Test', 'User2');
  user3_id := public.create_test_user('test3@example.com', 'Password123', 'Test', 'User3');
  
  -- Insert products that belong to these users
  INSERT INTO public.products (name, description, price, sku, cost, stock_quantity, created_by)
  VALUES 
    ('Laptop', 'Business laptop', 1299.99, 'LP1001', 900.00, 50, user1_id),
    ('Smartphone', '5G smartphone', 899.99, 'SP2002', 600.00, 100, user1_id),
    ('Tablet', '10-inch tablet', 499.99, 'TB3003', 350.00, 75, user2_id),
    ('Monitor', '27-inch 4K monitor', 349.99, 'MN4004', 250.00, 30, user2_id),
    ('Keyboard', 'Mechanical keyboard', 129.99, 'KB5005', 80.00, 200, user3_id);
    
  -- Add employees with user associations
  INSERT INTO public.employees (user_id, first_name, last_name, position, department, salary, hire_date, ssn, bank_account)
  VALUES
    (user1_id, 'Test', 'User1', 'Manager', 'Sales', 85000.00, '2022-01-15', '123-45-6789', 'ACCT123456789'),
    (user2_id, 'Test', 'User2', 'Developer', 'IT', 95000.00, '2022-02-20', '234-56-7890', 'ACCT234567890'),
    (user3_id, 'Test', 'User3', 'Analyst', 'Finance', 78000.00, '2022-03-10', '345-67-8901', 'ACCT345678901');
    
  -- Add order items linked to products and orders
  INSERT INTO public.order_items (order_id, product_id, quantity, unit_price)
  VALUES
    ((SELECT id FROM public.orders LIMIT 1 OFFSET 0), (SELECT id FROM public.products WHERE name = 'Laptop'), 1, 1299.99),
    ((SELECT id FROM public.orders LIMIT 1 OFFSET 0), (SELECT id FROM public.products WHERE name = 'Keyboard'), 1, 129.99),
    ((SELECT id FROM public.orders LIMIT 1 OFFSET 1), (SELECT id FROM public.products WHERE name = 'Smartphone'), 1, 899.99),
    ((SELECT id FROM public.orders LIMIT 1 OFFSET 2), (SELECT id FROM public.products WHERE name = 'Monitor'), 2, 349.99),
    ((SELECT id FROM public.orders LIMIT 1 OFFSET 2), (SELECT id FROM public.products WHERE name = 'Tablet'), 2, 499.99);
END $$;

-- Add auth.mfa_factors table if it doesn't exist (for proper MFA testing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'auth' 
    AND table_name = 'mfa_factors'
  ) THEN
    CREATE TABLE auth.mfa_factors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      friendly_name TEXT,
      factor_type TEXT CHECK (factor_type IN ('totp', 'webauthn')),
      status TEXT CHECK (status IN ('unverified', 'verified')),
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      secret TEXT,
      unconfirmed_at TIMESTAMPTZ
    );
    
    -- Add MFA factor for one user (to test mixed MFA compliance)
    INSERT INTO auth.mfa_factors (user_id, friendly_name, factor_type, status, secret)
    VALUES (
      (SELECT id FROM auth.users WHERE email = 'test1@example.com'),
      'My TOTP App',
      'totp',
      'verified',
      'JBSWY3DPEHPK3PXP'
    );
  END IF;
END $$;

-- Update auth.config for MFA testing if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'auth' 
    AND table_name = 'config'
  ) THEN
    -- Set MFA to disabled (so your fix can enable it)
    UPDATE auth.config 
    SET raw_app_meta_config = raw_app_meta_config || '{"enable_mfa": false}'::jsonb
    WHERE id = 1;
  END IF;
END $$;

-- Set appropriate permissions
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;