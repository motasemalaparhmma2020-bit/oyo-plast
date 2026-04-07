--
-- PostgreSQL database dump
--

\restrict 7zgsb5tD6Rpkl4SiOZlaOqqAwAldOpg6BUfcHmmwYPZzq9ltlKbbLrlDhjbmrLP

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: banners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.banners (
    id integer NOT NULL,
    title text NOT NULL,
    subtitle text,
    image_url text NOT NULL,
    link_url text DEFAULT '/products'::text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: banners_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.banners_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: banners_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.banners_id_seq OWNED BY public.banners.id;


--
-- Name: cart_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cart_items (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    selected_bag_color text,
    print_color_count integer DEFAULT 0,
    print_color_1 text,
    print_color_2 text,
    print_color_3 text,
    unit_price numeric,
    selected_size text,
    selected_color text,
    custom_printing boolean DEFAULT false,
    design_notes text,
    design_file_url text
);


--
-- Name: cart_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cart_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cart_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cart_items_id_seq OWNED BY public.cart_items.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    image_url text NOT NULL,
    icon_url text,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: coupons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupons (
    id integer NOT NULL,
    code text NOT NULL,
    marketer_id character varying NOT NULL,
    discount_percent integer DEFAULT 5 NOT NULL,
    marketer_commission_percent integer DEFAULT 5 NOT NULL,
    usage_count integer DEFAULT 0 NOT NULL,
    max_usage integer,
    is_active boolean DEFAULT true NOT NULL,
    expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: coupons_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.coupons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: coupons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.coupons_id_seq OWNED BY public.coupons.id;


--
-- Name: digital_wallets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.digital_wallets (
    id integer NOT NULL,
    name text NOT NULL,
    logo_url text,
    receiver_name text NOT NULL,
    phone_number text NOT NULL,
    purchase_code text NOT NULL,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    requires_proof boolean DEFAULT true NOT NULL,
    instructions text
);


--
-- Name: digital_wallets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.digital_wallets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: digital_wallets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.digital_wallets_id_seq OWNED BY public.digital_wallets.id;


--
-- Name: display_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.display_settings (
    id integer NOT NULL,
    category_size integer DEFAULT 72 NOT NULL,
    categories_per_row integer DEFAULT 4 NOT NULL,
    show_categories boolean DEFAULT true NOT NULL,
    product_card_width integer DEFAULT 160 NOT NULL,
    product_card_height integer DEFAULT 200 NOT NULL,
    offer_banner_height integer DEFAULT 72 NOT NULL,
    show_offer_banners boolean DEFAULT true NOT NULL,
    updated_at timestamp without time zone DEFAULT now(),
    product_card_margin integer DEFAULT 8 NOT NULL,
    product_card_padding_v integer DEFAULT 8 NOT NULL,
    price_font_size integer DEFAULT 16 NOT NULL,
    discount_bubble_size integer DEFAULT 28 NOT NULL,
    quantity_button_height integer DEFAULT 40 NOT NULL,
    image_mode text DEFAULT 'card'::text NOT NULL,
    detail_image_height integer DEFAULT 380 NOT NULL,
    detail_image_mode text DEFAULT 'contain'::text NOT NULL,
    detail_price_font_size integer DEFAULT 22 NOT NULL,
    detail_add_to_cart_height integer DEFAULT 52 NOT NULL,
    detail_show_related boolean DEFAULT true NOT NULL,
    detail_show_reviews boolean DEFAULT true NOT NULL,
    detail_thumbnail_size integer DEFAULT 64 NOT NULL,
    discount_badge_bg text DEFAULT '#ef4444'::text NOT NULL,
    show_sticky_cart_bar boolean DEFAULT true NOT NULL,
    detail_padding_v integer DEFAULT 8 NOT NULL,
    detail_margin_h integer DEFAULT 16 NOT NULL,
    detail_discount_bubble_size integer DEFAULT 36 NOT NULL,
    detail_show_thumbnails boolean DEFAULT true NOT NULL,
    sadeem_show_old_price boolean DEFAULT true NOT NULL,
    sadeem_show_discount_badge boolean DEFAULT true NOT NULL,
    sadeem_show_rating boolean DEFAULT true NOT NULL,
    sadeem_show_sold_count boolean DEFAULT true NOT NULL,
    sadeem_show_shipping boolean DEFAULT true NOT NULL,
    sadeem_show_returns boolean DEFAULT true NOT NULL,
    sadeem_free_shipping_min integer DEFAULT 0 NOT NULL,
    sadeem_marketer_discount integer DEFAULT 0 NOT NULL,
    shipping_fee integer DEFAULT 0 NOT NULL,
    cod_enabled boolean DEFAULT true NOT NULL,
    slider_height integer DEFAULT 414 NOT NULL,
    offer_banner_cols integer DEFAULT 2 NOT NULL,
    detail_section_gap integer DEFAULT 12 NOT NULL,
    detail_top_padding integer DEFAULT 8 NOT NULL
);


--
-- Name: display_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.display_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: display_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.display_settings_id_seq OWNED BY public.display_settings.id;


--
-- Name: end_customer_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.end_customer_contacts (
    id integer NOT NULL,
    marketer_id character varying NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    address text,
    city text,
    notes text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: end_customer_contacts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.end_customer_contacts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: end_customer_contacts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.end_customer_contacts_id_seq OWNED BY public.end_customer_contacts.id;


--
-- Name: home_page_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.home_page_settings (
    id integer NOT NULL,
    primary_color text DEFAULT '#06B6D4'::text NOT NULL,
    accent_color text DEFAULT '#0891B2'::text NOT NULL,
    show_header boolean DEFAULT true NOT NULL,
    show_banners boolean DEFAULT true NOT NULL,
    show_offers boolean DEFAULT true NOT NULL,
    show_categories boolean DEFAULT true NOT NULL,
    updated_at timestamp without time zone DEFAULT now(),
    footer_privacy_text text DEFAULT 'سياسة الخصوصية'::text NOT NULL,
    footer_affiliate_text text DEFAULT 'التسويق بالعمولة'::text NOT NULL,
    footer_returns_text text DEFAULT 'سياسة الاسترجاع'::text NOT NULL,
    footer_bottom_text text DEFAULT 'أويو بلاست - مستلزمات التغليف'::text NOT NULL,
    signup_entry_mode text DEFAULT 'cart'::text NOT NULL,
    privacy_content text,
    returns_content text,
    affiliate_content text,
    login_flow text DEFAULT 'checkout'::text NOT NULL
);


--
-- Name: home_page_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.home_page_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: home_page_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.home_page_settings_id_seq OWNED BY public.home_page_settings.id;


--
-- Name: home_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.home_sections (
    id integer NOT NULL,
    title text NOT NULL,
    promotional_tag text DEFAULT 'bestsellers'::text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    item_count integer DEFAULT 6 NOT NULL,
    display_mode text DEFAULT 'grid2'::text NOT NULL,
    banner_height integer DEFAULT 180 NOT NULL,
    banner_item_width integer DEFAULT 160 NOT NULL,
    banner_price_font_size integer DEFAULT 14 NOT NULL,
    banner_name_font_size integer DEFAULT 12 NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: home_sections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.home_sections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: home_sections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.home_sections_id_seq OWNED BY public.home_sections.id;


--
-- Name: logo_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.logo_settings (
    id integer NOT NULL,
    logo_url text,
    splash_bg_url text,
    splash_bg_color character varying(7) DEFAULT '#ffffff'::character varying,
    splash_text text DEFAULT 'أويو بلاست'::text,
    splash_text_color character varying(7) DEFAULT '#2196F3'::character varying,
    show_splash boolean DEFAULT true,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: logo_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.logo_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: logo_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.logo_settings_id_seq OWNED BY public.logo_settings.id;


--
-- Name: marketer_commissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketer_commissions (
    id integer NOT NULL,
    marketer_id character varying NOT NULL,
    order_id integer NOT NULL,
    gross_amount numeric NOT NULL,
    commission_amount numeric NOT NULL,
    commission_rate numeric NOT NULL,
    currency text DEFAULT 'YER'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    hold_until timestamp without time zone,
    released_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: marketer_commissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.marketer_commissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: marketer_commissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.marketer_commissions_id_seq OWNED BY public.marketer_commissions.id;


--
-- Name: marketer_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketer_profiles (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    tier text DEFAULT 'bronze'::text NOT NULL,
    commission_rate numeric DEFAULT '5'::numeric NOT NULL,
    total_earnings numeric DEFAULT '0'::numeric NOT NULL,
    pending_earnings numeric DEFAULT '0'::numeric NOT NULL,
    is_approved boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: marketer_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.marketer_profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: marketer_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.marketer_profiles_id_seq OWNED BY public.marketer_profiles.id;


--
-- Name: navigation_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.navigation_settings (
    id integer NOT NULL,
    show_printing_section boolean DEFAULT true NOT NULL,
    updated_at timestamp without time zone DEFAULT now(),
    enable_variant_product_page boolean DEFAULT false NOT NULL,
    show_signup_entry_point boolean DEFAULT true NOT NULL,
    lock_mobile_pwa_mode boolean DEFAULT true NOT NULL,
    disable_pinch_zoom boolean DEFAULT true NOT NULL,
    disable_horizontal_scroll boolean DEFAULT true NOT NULL,
    enable_phone_login boolean DEFAULT true NOT NULL,
    enable_email_login boolean DEFAULT true NOT NULL,
    login_show_on_top boolean DEFAULT false NOT NULL,
    login_show_on_checkout boolean DEFAULT true NOT NULL,
    login_show_on_account boolean DEFAULT true NOT NULL
);


--
-- Name: navigation_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.navigation_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: navigation_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.navigation_settings_id_seq OWNED BY public.navigation_settings.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type text DEFAULT 'order'::text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    order_id integer,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offers (
    id integer NOT NULL,
    title text NOT NULL,
    discount_percent integer NOT NULL,
    image_url text,
    link_url text DEFAULT '/products'::text,
    bg_color text DEFAULT 'blue'::text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: offers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.offers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: offers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.offers_id_seq OWNED BY public.offers.id;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id integer NOT NULL,
    order_id integer NOT NULL,
    product_id integer,
    quantity integer NOT NULL,
    price numeric NOT NULL,
    selected_bag_color text,
    print_color_count integer DEFAULT 0,
    print_color_1 text,
    print_color_2 text,
    print_color_3 text,
    selected_size text,
    selected_color text,
    custom_printing boolean DEFAULT false,
    design_notes text,
    design_file_url text
);


--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    user_id character varying,
    status text DEFAULT 'pending'::text NOT NULL,
    total numeric NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    deposit_amount numeric,
    payment_method text DEFAULT 'cash_on_delivery'::text,
    receipt_image_url text,
    customer_phone text,
    shipping_city text,
    shipping_address text,
    notes text,
    currency text DEFAULT 'YER'::text NOT NULL,
    tracking_number text,
    gps_coordinates text,
    marketer_id character varying,
    end_customer_contact_id integer,
    is_marketer_order boolean DEFAULT false,
    preferred_delivery_time text,
    coupon_code text,
    discount_amount numeric,
    subtotal_before_discount numeric,
    customer_name text,
    customer_email text,
    shipping_option text DEFAULT 'normal'::text,
    shipping_cost numeric DEFAULT '0'::numeric
);


--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: pending_sync_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pending_sync_orders (
    id integer NOT NULL,
    guest_id text NOT NULL,
    order_data jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    synced_at timestamp without time zone
);


--
-- Name: pending_sync_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pending_sync_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pending_sync_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pending_sync_orders_id_seq OWNED BY public.pending_sync_orders.id;


--
-- Name: phone_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.phone_verifications (
    id integer NOT NULL,
    phone text NOT NULL,
    code text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: phone_verifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.phone_verifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: phone_verifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.phone_verifications_id_seq OWNED BY public.phone_verifications.id;


--
-- Name: points_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.points_transactions (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    type text NOT NULL,
    points integer NOT NULL,
    description text,
    order_id integer,
    review_id integer,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: points_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.points_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: points_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.points_transactions_id_seq OWNED BY public.points_transactions.id;


--
-- Name: product_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_views (
    id integer NOT NULL,
    user_id character varying,
    session_id text,
    product_id integer NOT NULL,
    category_id integer,
    viewed_at timestamp without time zone DEFAULT now()
);


--
-- Name: product_views_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_views_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_views_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_views_id_seq OWNED BY public.product_views.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id integer NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    price numeric NOT NULL,
    category_id integer NOT NULL,
    image_url text NOT NULL,
    stock integer DEFAULT 100 NOT NULL,
    price_sar numeric,
    colors text[],
    allow_design_upload boolean DEFAULT false NOT NULL,
    bulk_pricing text,
    sizes text[],
    rating numeric DEFAULT '5'::numeric,
    review_count integer DEFAULT 0,
    sold_count integer DEFAULT 0,
    commission_hold_days integer DEFAULT 2,
    marketer_commission_rate numeric,
    has_printing_options boolean DEFAULT false,
    base_bag_price numeric,
    single_color_print_price numeric,
    available_bag_colors text[],
    image_urls text[],
    size_pricing text,
    printing_price_per_unit numeric,
    tags text[],
    show_reviews boolean DEFAULT true NOT NULL,
    show_in_printing boolean DEFAULT false NOT NULL,
    enable_variant_ui boolean DEFAULT false NOT NULL,
    color_images text,
    original_price numeric,
    original_price_sar numeric,
    discount_percent integer,
    promotional_tags text[],
    enable_smart_variants boolean DEFAULT false NOT NULL,
    smart_variants text
);


--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id integer NOT NULL,
    product_id integer NOT NULL,
    user_id character varying NOT NULL,
    rating integer NOT NULL,
    comment text,
    created_at timestamp without time zone DEFAULT now(),
    image_url text
);


--
-- Name: reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reviews_id_seq OWNED BY public.reviews.id;


--
-- Name: reward_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reward_points (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    points integer DEFAULT 0 NOT NULL,
    lifetime_points integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: reward_points_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reward_points_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reward_points_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reward_points_id_seq OWNED BY public.reward_points.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    sid character varying NOT NULL,
    sess jsonb NOT NULL,
    expire timestamp without time zone NOT NULL
);


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    id integer NOT NULL,
    key text NOT NULL,
    value text NOT NULL
);


--
-- Name: settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.settings_id_seq OWNED BY public.settings.id;


--
-- Name: user_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_addresses (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    name text NOT NULL,
    city text NOT NULL,
    address text NOT NULL,
    phone text NOT NULL,
    is_default boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: user_addresses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_addresses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_addresses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_addresses_id_seq OWNED BY public.user_addresses.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    email character varying,
    first_name character varying,
    last_name character varying,
    profile_image_url character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    phone character varying,
    city character varying,
    business_type character varying,
    is_phone_verified character varying DEFAULT 'false'::character varying,
    country character varying DEFAULT 'اليمن'::character varying,
    governorate character varying,
    district character varying,
    neighborhood character varying,
    street character varying,
    landmark character varying,
    full_name character varying,
    account_type character varying DEFAULT 'customer'::character varying,
    password_hash character varying,
    auth_provider character varying DEFAULT 'email'::character varying,
    is_email_verified character varying DEFAULT 'false'::character varying
);


--
-- Name: visitor_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visitor_sessions (
    id integer NOT NULL,
    session_id text NOT NULL,
    user_id text,
    first_seen timestamp without time zone DEFAULT now() NOT NULL,
    last_seen timestamp without time zone DEFAULT now() NOT NULL,
    page_views integer DEFAULT 1 NOT NULL
);


--
-- Name: visitor_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.visitor_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: visitor_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.visitor_sessions_id_seq OWNED BY public.visitor_sessions.id;


--
-- Name: wallet_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallet_transactions (
    id integer NOT NULL,
    wallet_id integer NOT NULL,
    user_id character varying NOT NULL,
    type text NOT NULL,
    amount numeric NOT NULL,
    currency text DEFAULT 'YER'::text NOT NULL,
    description text,
    order_id integer,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: wallet_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wallet_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wallet_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wallet_transactions_id_seq OWNED BY public.wallet_transactions.id;


--
-- Name: wallets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallets (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    balance_yer numeric DEFAULT '0'::numeric NOT NULL,
    balance_sar numeric DEFAULT '0'::numeric NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: wallets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wallets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wallets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wallets_id_seq OWNED BY public.wallets.id;


--
-- Name: wishlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wishlist (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    product_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: wishlist_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wishlist_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wishlist_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wishlist_id_seq OWNED BY public.wishlist.id;


--
-- Name: banners id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banners ALTER COLUMN id SET DEFAULT nextval('public.banners_id_seq'::regclass);


--
-- Name: cart_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items ALTER COLUMN id SET DEFAULT nextval('public.cart_items_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: coupons id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons ALTER COLUMN id SET DEFAULT nextval('public.coupons_id_seq'::regclass);


--
-- Name: digital_wallets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.digital_wallets ALTER COLUMN id SET DEFAULT nextval('public.digital_wallets_id_seq'::regclass);


--
-- Name: display_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.display_settings ALTER COLUMN id SET DEFAULT nextval('public.display_settings_id_seq'::regclass);


--
-- Name: end_customer_contacts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.end_customer_contacts ALTER COLUMN id SET DEFAULT nextval('public.end_customer_contacts_id_seq'::regclass);


--
-- Name: home_page_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_page_settings ALTER COLUMN id SET DEFAULT nextval('public.home_page_settings_id_seq'::regclass);


--
-- Name: home_sections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_sections ALTER COLUMN id SET DEFAULT nextval('public.home_sections_id_seq'::regclass);


--
-- Name: logo_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logo_settings ALTER COLUMN id SET DEFAULT nextval('public.logo_settings_id_seq'::regclass);


--
-- Name: marketer_commissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketer_commissions ALTER COLUMN id SET DEFAULT nextval('public.marketer_commissions_id_seq'::regclass);


--
-- Name: marketer_profiles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketer_profiles ALTER COLUMN id SET DEFAULT nextval('public.marketer_profiles_id_seq'::regclass);


--
-- Name: navigation_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.navigation_settings ALTER COLUMN id SET DEFAULT nextval('public.navigation_settings_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: offers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offers ALTER COLUMN id SET DEFAULT nextval('public.offers_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: pending_sync_orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_sync_orders ALTER COLUMN id SET DEFAULT nextval('public.pending_sync_orders_id_seq'::regclass);


--
-- Name: phone_verifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phone_verifications ALTER COLUMN id SET DEFAULT nextval('public.phone_verifications_id_seq'::regclass);


--
-- Name: points_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.points_transactions ALTER COLUMN id SET DEFAULT nextval('public.points_transactions_id_seq'::regclass);


--
-- Name: product_views id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_views ALTER COLUMN id SET DEFAULT nextval('public.product_views_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: reviews id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews ALTER COLUMN id SET DEFAULT nextval('public.reviews_id_seq'::regclass);


--
-- Name: reward_points id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_points ALTER COLUMN id SET DEFAULT nextval('public.reward_points_id_seq'::regclass);


--
-- Name: settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings ALTER COLUMN id SET DEFAULT nextval('public.settings_id_seq'::regclass);


--
-- Name: user_addresses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_addresses ALTER COLUMN id SET DEFAULT nextval('public.user_addresses_id_seq'::regclass);


--
-- Name: visitor_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_sessions ALTER COLUMN id SET DEFAULT nextval('public.visitor_sessions_id_seq'::regclass);


--
-- Name: wallet_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions ALTER COLUMN id SET DEFAULT nextval('public.wallet_transactions_id_seq'::regclass);


--
-- Name: wallets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets ALTER COLUMN id SET DEFAULT nextval('public.wallets_id_seq'::regclass);


--
-- Name: wishlist id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist ALTER COLUMN id SET DEFAULT nextval('public.wishlist_id_seq'::regclass);


--
-- Data for Name: banners; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.banners (id, title, subtitle, image_url, link_url, is_active, sort_order, created_at) FROM stdin;
1	أكياس قماش مسطح	صحيفة وآمنة لبيئتك	/products/product_1774396904531_b5w0cq.webp	/products?category=5	t	0	2026-03-31 14:28:59.44392
2	أكياس قماش شيال	متينة وعملية للتسوق	/products/product_1774397031697_2khbb.webp	/products?category=5	t	1	2026-03-31 14:28:59.44392
3	علاقي صافي	ألوان متعددة وجودة عالية	/products/product_1774391025638_cwgwbe.webp	/products?category=9	t	2	2026-03-31 14:28:59.44392
4	طباعة مخصصة	صنع هويتك الخاصة	/products/product_1774396928119_m2npbu.webp	/products?category=14	t	3	2026-03-31 14:28:59.44392
5	عرض خاص اليوم	خصم 20% على الطلبات الكبيرة	/products/product_1774391026388_l5vi5b.webp	/products	t	4	2026-03-31 14:28:59.44392
\.


--
-- Data for Name: cart_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cart_items (id, user_id, product_id, quantity, selected_bag_color, print_color_count, print_color_1, print_color_2, print_color_3, unit_price, selected_size, selected_color, custom_printing, design_notes, design_file_url) FROM stdin;
4	122c4dcf-1222-4699-a917-9e6c40aea338	6	4	\N	0	\N	\N	\N	\N	25×35	أسود	t	\N	\N
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.categories (id, name, slug, image_url, icon_url, sort_order, is_active) FROM stdin;
1	Plastic Products	plastic	https://images.unsplash.com/photo-1623366302587-bca291d2d398?w=800	\N	0	t
3	Aluminum Foil	aluminum	https://images.unsplash.com/photo-1626127117172-e56598c8c6f9?w=800	\N	0	t
5	أكياس قماشية	fabric-bags	/assets/IMG-20251116-WA0003_1766774728668.jpg	\N	0	t
9	أكياس علاقي	hanging-bags	/assets/IMG-20251116-WA0009_1766774728700.jpg	\N	0	t
14	طباعة وتصميم	printing	/assets/FB_IMG_1766862380975_1766863811074.jpg	\N	0	t
\.


--
-- Data for Name: coupons; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.coupons (id, code, marketer_id, discount_percent, marketer_commission_percent, usage_count, max_usage, is_active, expires_at, created_at) FROM stdin;
\.


--
-- Data for Name: digital_wallets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.digital_wallets (id, name, logo_url, receiver_name, phone_number, purchase_code, is_active, sort_order, created_at, updated_at, requires_proof, instructions) FROM stdin;
1	محفظة جوالي	data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI0U1MzkzNSIgcng9IjE0Ii8+PHRleHQgeD0iNTAiIHk9IjQyIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjAiIGZvbnQtd2VpZ2h0PSJib2xkIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSI+2KzZiNin2YTZijwvdGV4dD48L3N2Zz4=	معتصم محمد احمد الاهدل	774997589		t	1	2026-04-05 20:18:31.479936	2026-04-05 20:18:31.479936	t	حوّل المبلغ ثم أرسل صورة الإيصال
2	محفظة جيب	data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzJFN0QzMiIgcng9IjE0Ii8+PHRleHQgeD0iNTAiIHk9IjU4IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjYiIGZvbnQtd2VpZ2h0PSJib2xkIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSI+2KzZitioPC90ZXh0Pjwvc3ZnPg==	معتصم محمد احمد الاهدل	774997589		t	2	2026-04-05 20:18:31.483534	2026-04-05 20:18:31.483534	t	حوّل المبلغ ثم أرسل صورة الإيصال
3	ون كاش	data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzE1NjVDMCIgcng9IjE0Ii8+PHRleHQgeD0iNTAiIHk9IjQyIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZvbnQtd2VpZ2h0PSJib2xkIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSI+2YjZhiDZg9in2LQ8L3RleHQ+PC9zdmc+	معتصم محمد احمد الاهدل	774997589		t	3	2026-04-05 20:18:31.492189	2026-04-05 20:18:31.492189	t	حوّل المبلغ ثم أرسل صورة الإيصال
4	بنك الكريمي	data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzAwNjk1QyIgcng9IjE0Ii8+PHRleHQgeD0iNTAiIHk9IjM2IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZvbnQtd2VpZ2h0PSJib2xkIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSI+2KjZhtmDPC90ZXh0Pjx0ZXh0IHg9IjUwIiB5PSI1OCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmb250LXdlaWdodD0iYm9sZCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiPtin2YTZg9ix2YrZhdmKPC90ZXh0Pjwvc3ZnPg==	معتصم محمد احمد الاهدل	774997589		t	4	2026-04-05 20:18:31.495652	2026-04-05 20:18:31.495652	t	حوّل المبلغ ثم أرسل صورة الإيصال
\.


--
-- Data for Name: display_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.display_settings (id, category_size, categories_per_row, show_categories, product_card_width, product_card_height, offer_banner_height, show_offer_banners, updated_at, product_card_margin, product_card_padding_v, price_font_size, discount_bubble_size, quantity_button_height, image_mode, detail_image_height, detail_image_mode, detail_price_font_size, detail_add_to_cart_height, detail_show_related, detail_show_reviews, detail_thumbnail_size, discount_badge_bg, show_sticky_cart_bar, detail_padding_v, detail_margin_h, detail_discount_bubble_size, detail_show_thumbnails, sadeem_show_old_price, sadeem_show_discount_badge, sadeem_show_rating, sadeem_show_sold_count, sadeem_show_shipping, sadeem_show_returns, sadeem_free_shipping_min, sadeem_marketer_discount, shipping_fee, cod_enabled, slider_height, offer_banner_cols, detail_section_gap, detail_top_padding) FROM stdin;
1	72	4	t	160	200	72	t	2026-04-05 15:26:52.378	8	12	16	0	40	card	400	contain	20	56	t	t	72	#ef4444	f	8	16	36	t	t	t	t	t	t	t	0	0	0	t	414	2	12	8
\.


--
-- Data for Name: end_customer_contacts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.end_customer_contacts (id, marketer_id, name, phone, address, city, notes, created_at) FROM stdin;
\.


--
-- Data for Name: home_page_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.home_page_settings (id, primary_color, accent_color, show_header, show_banners, show_offers, show_categories, updated_at, footer_privacy_text, footer_affiliate_text, footer_returns_text, footer_bottom_text, signup_entry_mode, privacy_content, returns_content, affiliate_content, login_flow) FROM stdin;
1	#06B6D4	#0891B2	t	t	t	t	2026-04-04 23:24:21.415	سياسة الخصوصية	التسويق بالعمولة	سياسة الاسترجاع	أويو بلاست - مستلزمات التغليف	cart	\N	\N	\N	checkout
\.


--
-- Data for Name: home_sections; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.home_sections (id, title, promotional_tag, enabled, priority, item_count, display_mode, banner_height, banner_item_width, banner_price_font_size, banner_name_font_size, created_at) FROM stdin;
4	أكياس تغليف فاخرة	bestsellers	t	0	6	banner	220	180	15	13	2026-04-05 15:25:40.632719
1	أكياس تغليف فاخرة	new	t	2	4	banner	220	200	15	13	2026-04-05 15:19:56.900299
\.


--
-- Data for Name: logo_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.logo_settings (id, logo_url, splash_bg_url, splash_bg_color, splash_text, splash_text_color, show_splash, updated_at) FROM stdin;
\.


--
-- Data for Name: marketer_commissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.marketer_commissions (id, marketer_id, order_id, gross_amount, commission_amount, commission_rate, currency, status, hold_until, released_at, created_at) FROM stdin;
\.


--
-- Data for Name: marketer_profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.marketer_profiles (id, user_id, tier, commission_rate, total_earnings, pending_earnings, is_approved, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: navigation_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.navigation_settings (id, show_printing_section, updated_at, enable_variant_product_page, show_signup_entry_point, lock_mobile_pwa_mode, disable_pinch_zoom, disable_horizontal_scroll, enable_phone_login, enable_email_login, login_show_on_top, login_show_on_checkout, login_show_on_account) FROM stdin;
1	t	2026-04-06 08:38:21.791	t	t	t	t	t	t	t	t	t	t
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, user_id, title, message, type, is_read, order_id, created_at) FROM stdin;
\.


--
-- Data for Name: offers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.offers (id, title, discount_percent, image_url, link_url, bg_color, is_active, sort_order, created_at) FROM stdin;
1	شحن مجاني	0		/products	blue	t	0	2026-03-31 14:29:43.61717
2	الدفع عند الاستلام	0		/products	pink	t	1	2026-03-31 14:29:43.61717
3	خصم 20% على الطلبات الكبيرة	20		/products	green	t	2	2026-03-31 14:29:43.61717
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.order_items (id, order_id, product_id, quantity, price, selected_bag_color, print_color_count, print_color_1, print_color_2, print_color_3, selected_size, selected_color, custom_printing, design_notes, design_file_url) FROM stdin;
1	1	6	1	100	\N	0	\N	\N	\N	\N	\N	f	\N	\N
3	3	17	1	35	\N	0	\N	\N	\N	\N	\N	f	\N	\N
4	4	17	1	35	\N	0	\N	\N	\N	\N	\N	f	\N	\N
6	6	17	1	35	\N	0	\N	\N	\N	\N	\N	f	\N	\N
7	7	6	1	2500	\N	0	\N	\N	\N	\N	\N	f	\N	\N
8	8	12	2	1100	\N	0	\N	\N	\N	\N	\N	f	\N	\N
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.orders (id, user_id, status, total, created_at, deposit_amount, payment_method, receipt_image_url, customer_phone, shipping_city, shipping_address, notes, currency, tracking_number, gps_coordinates, marketer_id, end_customer_contact_id, is_marketer_order, preferred_delivery_time, coupon_code, discount_amount, subtotal_before_discount, customer_name, customer_email, shipping_option, shipping_cost) FROM stdin;
1	\N	pending	100	2026-04-01 15:01:26.051021	\N	cash_on_delivery	\N	967712345678	صنعاء	شارع النيل	\N	YER	\N	\N	\N	\N	f	\N	\N	\N	\N	أحمد	ahmed@example.com	normal	0
2	\N	pending	35	2026-04-05 00:16:38.821156	\N	cash_on_delivery	\N	777123456	صنعاء	شارع الزراعة، حي الجمهورية، مبنى رقم 15		YER	\N	\N	\N	\N	f	\N	\N	\N	\N	محمد احمد	guest@oyoplast.com	standard	0
3	\N	pending	35	2026-04-05 00:19:07.532716	\N	cash_on_delivery	\N	770000001	صنعاء	شارع التحرير حي الجمهورية		YER	\N	\N	\N	\N	f	\N	\N	\N	\N	محمد أحمد	guest@oyoplast.com	standard	0
4	\N	pending	35	2026-04-05 15:22:33.46146	\N	cash_on_delivery	\N	0771234567	صنعاء	صنعاء		YER	\N	\N	\N	\N	f	\N	\N	\N	\N	أحمد اختبار	guest@oyoplast.com	standard	0
5	\N	pending	5000	2026-04-05 20:27:08.448415	\N	cash_on_delivery	\N	774997589	صنعاء	شارع الستين	\N	YER	\N	\N	\N	\N	f	\N	\N	\N	\N	اختبار	test@test.com	standard	0
6	\N	pending	2500	2026-04-05 20:34:39.566528	\N	digital_wallet	\N	774997589	صنعاء	شارع الستين حي السبعين علامة مميزة	\N	YER	\N	\N	\N	\N	f	\N	\N	\N	\N	محمد علي	test@oyoplast.com	standard	0
7	\N	pending	2500	2026-04-05 20:37:46.18796	\N	cash_on_delivery	\N	774997589	صنعاء	شارع الستين حي السبعين		YER	\N	\N	\N	\N	f	\N	\N	\N	\N	محمد اختبار	guest@oyoplast.com	standard	0
8	\N	pending	2200	2026-04-07 15:03:00.609109	\N	cash	\N	+967774997589	صنعاء	شارع الاختبار	\N	YER	\N	\N	\N	\N	f	\N	\N	\N	\N	اختبار نظام	test@test.com	normal	0
\.


--
-- Data for Name: pending_sync_orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pending_sync_orders (id, guest_id, order_data, created_at, synced_at) FROM stdin;
\.


--
-- Data for Name: phone_verifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.phone_verifications (id, phone, code, attempts, verified, expires_at, created_at) FROM stdin;
3	+967774997589	361773	0	f	2026-04-07 15:07:01.147	2026-04-07 15:02:01.182363
\.


--
-- Data for Name: points_transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.points_transactions (id, user_id, type, points, description, order_id, review_id, created_at) FROM stdin;
\.


--
-- Data for Name: product_views; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.product_views (id, user_id, session_id, product_id, category_id, viewed_at) FROM stdin;
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.products (id, name, description, price, category_id, image_url, stock, price_sar, colors, allow_design_upload, bulk_pricing, sizes, rating, review_count, sold_count, commission_hold_days, marketer_commission_rate, has_printing_options, base_bag_price, single_color_print_price, available_bag_colors, image_urls, size_pricing, printing_price_per_unit, tags, show_reviews, show_in_printing, enable_variant_ui, color_images, original_price, original_price_sar, discount_percent, promotional_tags, enable_smart_variants, smart_variants) FROM stdin;
6	أكياس قماش مسطح	أكياس قماشية مسطحة عالية الجودة للطباعة والتصميم المخصص. مثالية للهدايا والمناسبات والأعمال التجارية. قماش قطني صديق للبيئة قابل لإعادة الاستخدام.	2500	14	/products/product_1774396904531_b5w0cq.webp	500	25	{أبيض,أسود,بيج,أزرق,أحمر,أخضر}	t	[{"qty": 50, "discount": 10}, {"qty": 100, "discount": 20}, {"qty": 500, "discount": 30}]	{25×35}	4.5	0	0	2	\N	t	35	10	{أبيض,أسود,بيج,أزرق,أحمر,أخضرك}	{/products/product_1774396904531_b5w0cq.webp,/products/product_1774396928119_m2npbu.webp,/products/product_1774396928815_1pfgvh.webp,/products/product_1774396929670_s6ku3a.webp,/products/product_1774396930227_yfv5kk.webp}	\N	10	{"كيس- قماشي"}	t	f	f	\N	\N	\N	\N	\N	f	\N
7	أكياس قماش شيال	أكياس قماشية بمقابض (شيال) متينة وعملية للتسوق والاستخدام اليومي. مناسبة للطباعة بشعار الشركة أو التصميم المخصص. قماش قطني عالي الجودة.	3000	14	/assets/FB_IMG_1766862387405_1766863811126.jpg	500	30	{أبيض,أسود,بيج,أزرق,أحمر,أخضر}	t	[{"qty": 50, "discount": 10}, {"qty": 100, "discount": 20}, {"qty": 500, "discount": 30}]	{"25×28 سم","30×32 سم","32×37 سم","35×42 سم","42×55 سم"}	4.5	0	0	2	\N	f	\N	\N	\N	\N	\N	\N	\N	t	f	f	\N	\N	\N	\N	\N	f	\N
8	أكياس قماش صندوقي	أكياس قماشية بقاعدة صندوقية واسعة لحمل المنتجات بشكل مستقيم. مثالية للمحلات التجارية والمطاعم والمخابز. قماش متين مع تصميم أنيق.	3500	14	/products/product_1774397031697_2khbb.webp	500	35	{أبيض,أسود,بيج,أزرق,أحمر,أخضر}	t	[{"qty": 50, "discount": 10}, {"qty": 100, "discount": 20}, {"qty": 500, "discount": 30}]	{"27×32×10 سم","25×30×10 سم","32×37×10 سم","32×27×10 سم","35×42×10 سم"}	4.5	0	0	2	\N	f	\N	\N	\N	{/products/product_1774397031697_2khbb.webp,/products/product_1774397032938_4f49ll.webp,/products/product_1774397033524_owwzz8.webp,/products/product_1774397034042_qob2uc.webp}	\N	\N	\N	t	f	f	\N	\N	\N	\N	\N	f	\N
12	علاقي رقم 8 صافي	أكياس علاقي رقم 8 صافي - متوفر بـ 5 ألوان: أحمر، أبيض، أصفر، أسود، أزرق - كما يتوفر مخطط	1100	9	/assets/٢٠٢٥٠٨١٧_٠٠٣٨٢٢_1766868645349.jpg	1000	7.86	{أحمر,أبيض,أصفر,أسود,أزرق,مخطط}	f	[{"qty": 100, "discount": 5}, {"qty": 500, "discount": 10}, {"qty": 1000, "discount": 15}]	{"رقم 8"}	4.5	0	0	2	\N	f	\N	\N	\N	\N	\N	\N	\N	t	f	f	\N	\N	\N	\N	\N	f	\N
13	علاقي رقم 9 صافي	أكياس علاقي رقم 9 صافي - متوفر بـ 5 ألوان: أحمر، أبيض، أصفر، أسود، أزرق - كما يتوفر مخطط وألوان	1200	9	/assets/٢٠٢٥٠٨١٧_٠٠٣٨٢٢_1766868645349.jpg	1000	8.57	{أحمر,أبيض,أصفر,أسود,أزرق,مخطط,ألوان}	f	[{"qty": 100, "discount": 5}, {"qty": 500, "discount": 10}, {"qty": 1000, "discount": 15}]	{"رقم 9"}	4.5	0	0	2	\N	f	\N	\N	\N	\N	\N	\N	\N	t	f	f	\N	\N	\N	\N	\N	f	\N
14	علاقي رقم 10.5 صافي	أكياس علاقي رقم 10.5 صافي - متوفر بـ 5 ألوان: أحمر، أبيض، أصفر، أسود، أزرق - كما يتوفر مخطط	1400	9	/assets/٢٠٢٥٠٨١٧_٠٠٣٨٢٢_1766868645349.jpg	1000	10.00	{أحمر,أبيض,أصفر,أسود,أزرق,مخطط}	f	[{"qty": 100, "discount": 5}, {"qty": 500, "discount": 10}, {"qty": 1000, "discount": 15}]	{"رقم 10.5"}	4.5	0	0	2	\N	f	\N	\N	\N	\N	\N	\N	\N	t	f	f	\N	\N	\N	\N	\N	f	\N
15	علاقي رقم 11 صافي أحمر	أكياس علاقي رقم 11 صافي لون أحمر - عالية الجودة	1500	9	/assets/٢٠٢٥٠٨١٧_٠٠٣٨٢٢_1766868645349.jpg	1000	10.71	{أحمر}	f	[{"qty": 100, "discount": 5}, {"qty": 500, "discount": 10}, {"qty": 1000, "discount": 15}]	{"رقم 11"}	4.5	0	0	2	\N	f	\N	\N	\N	\N	\N	\N	\N	t	f	f	\N	\N	\N	\N	\N	f	\N
16	علاقي رقم 12 صافي	أكياس علاقي رقم 12 صافي - متوفر بلونين: أحمر وأسود - عالية الجودة	1700	9	/assets/٢٠٢٥٠٨١٧_٠٠٣٨٢٢_1766868645349.jpg	1000	12.14	{أحمر,أسود}	f	[{"qty": 100, "discount": 5}, {"qty": 500, "discount": 10}, {"qty": 1000, "discount": 15}]	{"رقم 12"}	4.5	0	0	2	\N	f	\N	\N	\N	\N	\N	\N	\N	t	f	f	\N	\N	\N	\N	\N	f	\N
17	أكياس قماشيه شيال 	اكياس قماشيه انيقع	35	5	/api/products/image/17/0	1000	2.5	{أبيض,أزرق,أصفر}	t	\N	{صغير,وسط,كبير}	5	0	0	2	\N	t	35	10	{أبيض,أزرق,أصفر}	{/api/products/image/17/0}	\N	10	{كيس-قماشي}	t	f	t	\N	\N	\N	\N	\N	f	\N
\.


--
-- Data for Name: reviews; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reviews (id, product_id, user_id, rating, comment, created_at, image_url) FROM stdin;
\.


--
-- Data for Name: reward_points; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reward_points (id, user_id, points, lifetime_points, created_at, updated_at) FROM stdin;
1	122c4dcf-1222-4699-a917-9e6c40aea338	0	0	2026-03-25 00:17:41.835324	2026-03-25 00:17:41.835324
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sessions (sid, sess, expire) FROM stdin;
aLf9xbUbGX47T0FvGwdhq7YzsdvshqzN	{"cookie": {"path": "/", "secure": true, "expires": "2026-03-28T23:04:13.526Z", "httpOnly": true, "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"sub": "122c4dcf-1222-4699-a917-9e6c40aea338"}, "expires_at": 1774739053}}}	2026-04-02 22:08:28
\.


--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.settings (id, key, value) FROM stdin;
\.


--
-- Data for Name: user_addresses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_addresses (id, user_id, name, city, address, phone, is_default, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, first_name, last_name, profile_image_url, created_at, updated_at, phone, city, business_type, is_phone_verified, country, governorate, district, neighborhood, street, landmark, full_name, account_type, password_hash, auth_provider, is_email_verified) FROM stdin;
51827597	motasemalaparh.m.m.a2020@gmail.com	Motasem	mohamed Alahdal	\N	2025-12-26 19:42:46.262583	2026-03-21 21:02:52.593	\N	\N	\N	false	اليمن	\N	\N	\N	\N	\N	\N	customer	\N	email	false
122c4dcf-1222-4699-a917-9e6c40aea338	motasemalaparh.k.m.a@gmail.com	\N	\N	\N	2026-03-21 23:04:13.51295	2026-03-21 23:04:13.51295	774997589	\N	\N	false	اليمن	\N	\N	\N	\N	\N	معتصم الاهدل 	marketer	690259eca64c0aa381c4e49dcb784648:f5b41cd6e5da0e95a6998c0ac2992a77291bfadb42e2c9dc9ed92b3c57d461504118122341eb1a0bd889b1c1dba2a9301da892bb73d6daa01d8d48c57a3517c4	email	false
\.


--
-- Data for Name: visitor_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.visitor_sessions (id, session_id, user_id, first_seen, last_seen, page_views) FROM stdin;
1	w99m59t6lllmnmxt52v	\N	2026-04-06 08:37:26.821715	2026-04-06 08:38:26.423827	3
4	ti67i2ocwi7mnn3zzda	\N	2026-04-06 11:30:43.556143	2026-04-06 11:30:43.556143	1
5	4cme7453t2smnn4y6zb	\N	2026-04-06 11:57:19.78204	2026-04-06 11:57:25.930866	2
7	qa7y1rucc79mnn5aklq	\N	2026-04-06 12:06:57.248878	2026-04-06 12:06:57.248878	1
8	alvtxdwrmnmnnbxrs6	\N	2026-04-06 15:12:58.551445	2026-04-06 15:14:46.225956	2
10	rzwntxqe4zmnoe99y2	\N	2026-04-07 09:05:39.521629	2026-04-07 09:05:39.521629	1
11	6vqwhqdbuxmmnoke7n7	\N	2026-04-07 11:57:27.495669	2026-04-07 11:57:27.495669	1
12	fk886s73mm9mnoq9whd	\N	2026-04-07 14:42:04.104602	2026-04-07 14:42:04.104602	1
\.


--
-- Data for Name: wallet_transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.wallet_transactions (id, wallet_id, user_id, type, amount, currency, description, order_id, created_at) FROM stdin;
\.


--
-- Data for Name: wallets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.wallets (id, user_id, balance_yer, balance_sar, created_at, updated_at) FROM stdin;
1	122c4dcf-1222-4699-a917-9e6c40aea338	0	0	2026-03-25 00:17:41.826253	2026-03-25 00:17:41.826253
\.


--
-- Data for Name: wishlist; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.wishlist (id, user_id, product_id, created_at) FROM stdin;
\.


--
-- Name: banners_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.banners_id_seq', 5, true);


--
-- Name: cart_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.cart_items_id_seq', 36, true);


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.categories_id_seq', 14, true);


--
-- Name: coupons_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.coupons_id_seq', 1, false);


--
-- Name: digital_wallets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.digital_wallets_id_seq', 4, true);


--
-- Name: display_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.display_settings_id_seq', 1, true);


--
-- Name: end_customer_contacts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.end_customer_contacts_id_seq', 1, false);


--
-- Name: home_page_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.home_page_settings_id_seq', 1, true);


--
-- Name: home_sections_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.home_sections_id_seq', 4, true);


--
-- Name: logo_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.logo_settings_id_seq', 1, false);


--
-- Name: marketer_commissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.marketer_commissions_id_seq', 1, false);


--
-- Name: marketer_profiles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.marketer_profiles_id_seq', 1, false);


--
-- Name: navigation_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.navigation_settings_id_seq', 1, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notifications_id_seq', 1, false);


--
-- Name: offers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.offers_id_seq', 3, true);


--
-- Name: order_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.order_items_id_seq', 8, true);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.orders_id_seq', 8, true);


--
-- Name: pending_sync_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pending_sync_orders_id_seq', 1, false);


--
-- Name: phone_verifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.phone_verifications_id_seq', 3, true);


--
-- Name: points_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.points_transactions_id_seq', 1, false);


--
-- Name: product_views_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.product_views_id_seq', 1, false);


--
-- Name: products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.products_id_seq', 49, true);


--
-- Name: reviews_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.reviews_id_seq', 1, false);


--
-- Name: reward_points_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.reward_points_id_seq', 33, true);


--
-- Name: settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.settings_id_seq', 1, false);


--
-- Name: user_addresses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.user_addresses_id_seq', 1, false);


--
-- Name: visitor_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.visitor_sessions_id_seq', 12, true);


--
-- Name: wallet_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.wallet_transactions_id_seq', 1, false);


--
-- Name: wallets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.wallets_id_seq', 33, true);


--
-- Name: wishlist_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.wishlist_id_seq', 1, false);


--
-- Name: banners banners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banners
    ADD CONSTRAINT banners_pkey PRIMARY KEY (id);


--
-- Name: cart_items cart_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_slug_unique UNIQUE (slug);


--
-- Name: coupons coupons_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_code_unique UNIQUE (code);


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);


--
-- Name: digital_wallets digital_wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.digital_wallets
    ADD CONSTRAINT digital_wallets_pkey PRIMARY KEY (id);


--
-- Name: display_settings display_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.display_settings
    ADD CONSTRAINT display_settings_pkey PRIMARY KEY (id);


--
-- Name: end_customer_contacts end_customer_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.end_customer_contacts
    ADD CONSTRAINT end_customer_contacts_pkey PRIMARY KEY (id);


--
-- Name: home_page_settings home_page_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_page_settings
    ADD CONSTRAINT home_page_settings_pkey PRIMARY KEY (id);


--
-- Name: home_sections home_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_sections
    ADD CONSTRAINT home_sections_pkey PRIMARY KEY (id);


--
-- Name: logo_settings logo_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logo_settings
    ADD CONSTRAINT logo_settings_pkey PRIMARY KEY (id);


--
-- Name: marketer_commissions marketer_commissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketer_commissions
    ADD CONSTRAINT marketer_commissions_pkey PRIMARY KEY (id);


--
-- Name: marketer_profiles marketer_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketer_profiles
    ADD CONSTRAINT marketer_profiles_pkey PRIMARY KEY (id);


--
-- Name: marketer_profiles marketer_profiles_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketer_profiles
    ADD CONSTRAINT marketer_profiles_user_id_unique UNIQUE (user_id);


--
-- Name: navigation_settings navigation_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.navigation_settings
    ADD CONSTRAINT navigation_settings_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: offers offers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offers
    ADD CONSTRAINT offers_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: pending_sync_orders pending_sync_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_sync_orders
    ADD CONSTRAINT pending_sync_orders_pkey PRIMARY KEY (id);


--
-- Name: phone_verifications phone_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phone_verifications
    ADD CONSTRAINT phone_verifications_pkey PRIMARY KEY (id);


--
-- Name: points_transactions points_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.points_transactions
    ADD CONSTRAINT points_transactions_pkey PRIMARY KEY (id);


--
-- Name: product_views product_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_views
    ADD CONSTRAINT product_views_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: reward_points reward_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_points
    ADD CONSTRAINT reward_points_pkey PRIMARY KEY (id);


--
-- Name: reward_points reward_points_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_points
    ADD CONSTRAINT reward_points_user_id_unique UNIQUE (user_id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (sid);


--
-- Name: settings settings_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_key_unique UNIQUE (key);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: user_addresses user_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_addresses
    ADD CONSTRAINT user_addresses_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: visitor_sessions visitor_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_sessions
    ADD CONSTRAINT visitor_sessions_pkey PRIMARY KEY (id);


--
-- Name: visitor_sessions visitor_sessions_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_sessions
    ADD CONSTRAINT visitor_sessions_session_id_key UNIQUE (session_id);


--
-- Name: wallet_transactions wallet_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_user_id_unique UNIQUE (user_id);


--
-- Name: wishlist wishlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist
    ADD CONSTRAINT wishlist_pkey PRIMARY KEY (id);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_session_expire" ON public.sessions USING btree (expire);


--
-- Name: idx_phone_verifications_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_phone_verifications_phone ON public.phone_verifications USING btree (phone);


--
-- Name: idx_visitor_sessions_last_seen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_sessions_last_seen ON public.visitor_sessions USING btree (last_seen);


--
-- Name: idx_visitor_sessions_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_sessions_session ON public.visitor_sessions USING btree (session_id);


--
-- Name: cart_items cart_items_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: cart_items cart_items_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: coupons coupons_marketer_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_marketer_id_users_id_fk FOREIGN KEY (marketer_id) REFERENCES public.users(id);


--
-- Name: end_customer_contacts end_customer_contacts_marketer_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.end_customer_contacts
    ADD CONSTRAINT end_customer_contacts_marketer_id_users_id_fk FOREIGN KEY (marketer_id) REFERENCES public.users(id);


--
-- Name: marketer_commissions marketer_commissions_marketer_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketer_commissions
    ADD CONSTRAINT marketer_commissions_marketer_id_users_id_fk FOREIGN KEY (marketer_id) REFERENCES public.users(id);


--
-- Name: marketer_commissions marketer_commissions_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketer_commissions
    ADD CONSTRAINT marketer_commissions_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: marketer_profiles marketer_profiles_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketer_profiles
    ADD CONSTRAINT marketer_profiles_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: notifications notifications_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: notifications notifications_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: order_items order_items_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: order_items order_items_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: orders orders_marketer_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_marketer_id_users_id_fk FOREIGN KEY (marketer_id) REFERENCES public.users(id);


--
-- Name: orders orders_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: points_transactions points_transactions_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.points_transactions
    ADD CONSTRAINT points_transactions_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: points_transactions points_transactions_review_id_reviews_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.points_transactions
    ADD CONSTRAINT points_transactions_review_id_reviews_id_fk FOREIGN KEY (review_id) REFERENCES public.reviews(id);


--
-- Name: points_transactions points_transactions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.points_transactions
    ADD CONSTRAINT points_transactions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: product_views product_views_category_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_views
    ADD CONSTRAINT product_views_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: product_views product_views_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_views
    ADD CONSTRAINT product_views_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: product_views product_views_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_views
    ADD CONSTRAINT product_views_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: products products_category_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: reviews reviews_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: reviews reviews_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: reward_points reward_points_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_points
    ADD CONSTRAINT reward_points_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_addresses user_addresses_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_addresses
    ADD CONSTRAINT user_addresses_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: wallet_transactions wallet_transactions_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: wallet_transactions wallet_transactions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: wallet_transactions wallet_transactions_wallet_id_wallets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_wallet_id_wallets_id_fk FOREIGN KEY (wallet_id) REFERENCES public.wallets(id);


--
-- Name: wallets wallets_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: wishlist wishlist_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist
    ADD CONSTRAINT wishlist_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: wishlist wishlist_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist
    ADD CONSTRAINT wishlist_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict 7zgsb5tD6Rpkl4SiOZlaOqqAwAldOpg6BUfcHmmwYPZzq9ltlKbbLrlDhjbmrLP

