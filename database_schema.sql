-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.admin_logs (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  admin_id uuid,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  details jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT admin_logs_pkey PRIMARY KEY (id),
  CONSTRAINT admin_logs_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.app_settings (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT app_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.deliveries (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  order_id bigint,
  rider_id uuid,
  status text CHECK (status = ANY (ARRAY['assigned'::text, 'accepted'::text, 'picked_up'::text, 'delivered'::text, 'failed'::text, 'declined'::text])),
  assigned_at timestamp with time zone DEFAULT now(),
  delivered_at timestamp with time zone,
  notes text,
  accepted_at timestamp with time zone,
  picked_up_at timestamp with time zone,
  failed_at timestamp with time zone,
  rider_lat double precision,
  rider_lng double precision,
  attempt_count integer DEFAULT 0,
  max_attempts integer DEFAULT 3,
  CONSTRAINT deliveries_pkey PRIMARY KEY (id),
  CONSTRAINT deliveries_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT deliveries_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.delivery_proofs (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  delivery_id bigint NOT NULL,
  photo_url text,
  signature_data text,
  recipient_name text,
  notes text,
  delivered_at timestamp with time zone DEFAULT now(),
  CONSTRAINT delivery_proofs_pkey PRIMARY KEY (id),
  CONSTRAINT delivery_proofs_delivery_id_fkey FOREIGN KEY (delivery_id) REFERENCES public.deliveries(id)
);
CREATE TABLE public.favorites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  product_id bigint,
  inserted_at timestamp with time zone DEFAULT now(),
  CONSTRAINT favorites_pkey PRIMARY KEY (id),
  CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT favorites_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.notifications (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['order_status'::text, 'order_delivered'::text, 'order_cancelled'::text, 'promo'::text, 'system'::text])),
  title text NOT NULL,
  message text NOT NULL,
  data jsonb,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.order_items (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  order_id bigint,
  product_id bigint,
  quantity numeric NOT NULL,
  price_at_order numeric NOT NULL,
  product_name text,
  product_unit text,
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.orders (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid,
  admin_id uuid,
  total_amount numeric NOT NULL,
  delivery_address text NOT NULL,
  payment_method text CHECK (payment_method = ANY (ARRAY['Cash on Delivery'::text, 'G-Cash'::text])),
  status text DEFAULT 'Pending'::text CHECK (status = ANY (ARRAY['Pending'::text, 'Processing'::text, 'Out for Delivery'::text, 'Completed'::text, 'Cancelled'::text])),
  created_at timestamp with time zone DEFAULT now(),
  special_instructions text,
  notes text,
  order_number text UNIQUE,
  delivery_lat double precision,
  delivery_lng double precision,
  updated_at timestamp with time zone DEFAULT now(),
  delivery_fee numeric DEFAULT 0,
  cancellation_reason text,
  cancelled_at timestamp with time zone,
  cancelled_by uuid,
  customer_name text,
  estimated_delivery_time timestamp with time zone,
  rider_id uuid,
  archived boolean NOT NULL DEFAULT false,
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT orders_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.product_reviews (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  product_id bigint NOT NULL,
  user_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT product_reviews_pkey PRIMARY KEY (id),
  CONSTRAINT product_reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT product_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.products (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  description text,
  category text CHECK (category = ANY (ARRAY['Fuel'::text, 'Motor Oil'::text, 'Engine Oil'::text])),
  unit text NOT NULL,
  current_price numeric NOT NULL,
  stock_quantity numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  image_url text,
  updated_at timestamp with time zone DEFAULT now(),
  low_stock_threshold integer DEFAULT 10,
  discount_price numeric,
  barcode text,
  sku text,
  image_urls ARRAY,
  is_featured boolean DEFAULT false,
  CONSTRAINT products_pkey PRIMARY KEY (id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text NOT NULL,
  phone_number text UNIQUE,
  address text,
  role text DEFAULT 'customer'::text CHECK (role = ANY (ARRAY['customer'::text, 'admin'::text, 'rider'::text])),
  created_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  address_lat double precision,
  address_lng double precision,
  updated_at timestamp with time zone DEFAULT now(),
  vehicle_type text,
  vehicle_plate text,
  email text,
  fcm_token text,
  is_online boolean DEFAULT false,
  last_seen timestamp with time zone,
  avatar_url text,
  avatar_updated_at timestamp with time zone,
  notifications_enabled boolean DEFAULT true,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.rider_ratings (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  rider_id uuid NOT NULL,
  user_id uuid NOT NULL,
  delivery_id bigint NOT NULL UNIQUE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT rider_ratings_pkey PRIMARY KEY (id),
  CONSTRAINT rider_ratings_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES public.profiles(id),
  CONSTRAINT rider_ratings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT rider_ratings_delivery_id_fkey FOREIGN KEY (delivery_id) REFERENCES public.deliveries(id)
);
CREATE TABLE public.user_addresses (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  label text NOT NULL,
  address text NOT NULL,
  address_lat double precision,
  address_lng double precision,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_addresses_pkey PRIMARY KEY (id),
  CONSTRAINT user_addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);