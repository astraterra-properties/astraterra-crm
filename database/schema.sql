-- Astraterra CRM Database Schema
-- PostgreSQL Database Structure

-- Users & Authentication
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role VARCHAR(50) NOT NULL DEFAULT 'agent', -- admin, manager, agent, broker, viewer
    team_id INTEGER,
    commission_rate DECIMAL(5,2) DEFAULT 0.00,
    avatar_url TEXT,
    active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contacts Database
CREATE TABLE contacts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    type VARCHAR(50) DEFAULT 'buyer', -- buyer, seller, both, landlord, tenant
    location_preference TEXT,
    budget_min DECIMAL(15,2),
    budget_max DECIMAL(15,2),
    property_type VARCHAR(100), -- villa, apartment, townhouse, penthouse, etc.
    bedrooms INTEGER,
    purpose VARCHAR(50), -- buy, rent, invest
    timeline VARCHAR(100),
    must_haves TEXT,
    nice_to_haves TEXT,
    source VARCHAR(100), -- website, referral, walk-in, social media, blog
    source_details TEXT,
    notes TEXT,
    tags TEXT[], -- Array of tags
    assigned_to INTEGER REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'active', -- active, inactive, converted, lost
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leads Management
CREATE TABLE leads (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id),
    status VARCHAR(50) NOT NULL DEFAULT 'not_contacted', 
    -- not_contacted, contacted, qualified, hot, viewing_scheduled, 
    -- offer_made, deal_won, deal_lost, follow_up, not_interested, no_answer
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent
    assigned_to INTEGER REFERENCES users(id),
    budget DECIMAL(15,2),
    requirements TEXT,
    notes TEXT,
    source VARCHAR(100),
    source_url TEXT, -- which blog post brought this lead
    last_contact_date TIMESTAMP,
    next_follow_up TIMESTAMP,
    follow_up_notes TEXT,
    score INTEGER DEFAULT 0, -- Lead scoring 0-100
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Properties/Listings
CREATE TABLE properties (
    id SERIAL PRIMARY KEY,
    property_id VARCHAR(50) UNIQUE, -- PROP-XXXXXX
    title VARCHAR(500),
    type VARCHAR(100), -- villa, apartment, townhouse, penthouse, commercial, etc.
    location VARCHAR(255),
    bedrooms INTEGER,
    bathrooms INTEGER,
    size DECIMAL(10,2), -- Square feet
    price DECIMAL(15,2),
    purpose VARCHAR(50), -- sale, rent
    furnished BOOLEAN DEFAULT false,
    owner_name VARCHAR(255),
    owner_contact VARCHAR(50),
    owner_email VARCHAR(255),
    description TEXT,
    key_features TEXT[],
    status VARCHAR(50) DEFAULT 'available', -- available, under_offer, sold, rented, withdrawn
    photos TEXT[], -- Array of Google Drive URLs
    documents TEXT[], -- Array of document URLs
    listed_date DATE,
    sold_rented_date DATE,
    assigned_to INTEGER REFERENCES users(id),
    views_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Deals/Transactions
CREATE TABLE deals (
    id SERIAL PRIMARY KEY,
    deal_number VARCHAR(50) UNIQUE,
    lead_id INTEGER REFERENCES leads(id),
    property_id INTEGER REFERENCES properties(id),
    contact_id INTEGER REFERENCES contacts(id),
    agent_id INTEGER REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending',
    -- pending, contract_sent, contract_signed, under_processing, completed, cancelled
    deal_type VARCHAR(50), -- sale, rental
    deal_value DECIMAL(15,2),
    commission_percentage DECIMAL(5,2),
    commission_amount DECIMAL(15,2),
    start_date DATE,
    expected_close_date DATE,
    actual_close_date DATE,
    documents TEXT[],
    timeline JSONB, -- Store timeline events as JSON
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Viewings/Appointments
CREATE TABLE viewings (
    id SERIAL PRIMARY KEY,
    property_id INTEGER REFERENCES properties(id),
    contact_id INTEGER REFERENCES contacts(id),
    lead_id INTEGER REFERENCES leads(id),
    agent_id INTEGER REFERENCES users(id),
    scheduled_at TIMESTAMP NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, completed, cancelled, no_show
    feedback TEXT,
    rating INTEGER, -- 1-5 stars
    follow_up_required BOOLEAN DEFAULT false,
    follow_up_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Commission Tracking
CREATE TABLE commissions (
    id SERIAL PRIMARY KEY,
    deal_id INTEGER REFERENCES deals(id),
    broker_id INTEGER REFERENCES users(id), -- Filippo, etc.
    broker_name VARCHAR(255),
    commission_type VARCHAR(50), -- referral, agent, split
    percentage DECIMAL(5,2),
    amount DECIMAL(15,2),
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, paid
    payment_date DATE,
    payment_method VARCHAR(100), -- bank_transfer, cash, cheque
    payment_reference VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tasks Management
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    assigned_to INTEGER REFERENCES users(id),
    created_by INTEGER REFERENCES users(id),
    related_type VARCHAR(50), -- lead, deal, property, contact
    related_id INTEGER,
    due_date TIMESTAMP,
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, cancelled
    completed_at TIMESTAMP,
    reminder_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Communications Log
CREATE TABLE communications (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id),
    user_id INTEGER REFERENCES users(id),
    type VARCHAR(50), -- call, whatsapp, email, meeting, note
    direction VARCHAR(20), -- inbound, outbound
    content TEXT,
    duration_seconds INTEGER, -- For calls
    attachments TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Teams
CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    manager_id INTEGER REFERENCES users(id),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Property-Contact Matches (Auto-matching system)
CREATE TABLE property_matches (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id),
    property_id INTEGER REFERENCES properties(id),
    match_score INTEGER, -- 0-100
    match_criteria JSONB, -- What matched (budget, location, type, beds)
    status VARCHAR(50) DEFAULT 'suggested', -- suggested, viewed, interested, rejected
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity Log (Audit trail)
CREATE TABLE activity_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100), -- created, updated, deleted, viewed
    entity_type VARCHAR(50), -- lead, contact, property, deal
    entity_id INTEGER,
    changes JSONB, -- What changed
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Marketing Automation Tables

-- Email Campaigns
CREATE TABLE email_campaigns (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body_html TEXT,
    body_text TEXT,
    template_id INTEGER,
    status VARCHAR(50) DEFAULT 'draft', -- draft, scheduled, sending, sent, cancelled
    scheduled_at TIMESTAMP,
    sent_at TIMESTAMP,
    target_segment TEXT, -- JSON criteria for targeting
    recipients_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    clicked_count INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email Campaign Recipients
CREATE TABLE email_campaign_recipients (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES email_campaigns(id),
    contact_id INTEGER REFERENCES contacts(id),
    email VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, opened, clicked, bounced, failed
    sent_at TIMESTAMP,
    opened_at TIMESTAMP,
    clicked_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- WhatsApp Campaigns
CREATE TABLE whatsapp_campaigns (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    media_url TEXT,
    media_type VARCHAR(50), -- image, video, document
    status VARCHAR(50) DEFAULT 'draft', -- draft, scheduled, sending, sent, cancelled
    scheduled_at TIMESTAMP,
    sent_at TIMESTAMP,
    target_segment TEXT, -- JSON criteria for targeting
    recipients_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,
    replied_count INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- WhatsApp Campaign Recipients
CREATE TABLE whatsapp_campaign_recipients (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES whatsapp_campaigns(id),
    contact_id INTEGER REFERENCES contacts(id),
    phone VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, delivered, read, replied, failed
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    replied_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Social Media Posts
CREATE TABLE social_posts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500),
    content TEXT NOT NULL,
    media_urls TEXT[], -- Array of image/video URLs
    platforms VARCHAR(50)[], -- instagram, facebook, linkedin, twitter
    status VARCHAR(50) DEFAULT 'draft', -- draft, scheduled, published, failed
    scheduled_at TIMESTAMP,
    published_at TIMESTAMP,
    post_type VARCHAR(50) DEFAULT 'standard', -- standard, property_listing, blog_share
    related_property_id INTEGER REFERENCES properties(id),
    related_blog_id VARCHAR(100), -- Blog post ID from website
    engagement JSONB, -- {likes, comments, shares, impressions} per platform
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Social Media Platform Posts (tracking per platform)
CREATE TABLE social_platform_posts (
    id SERIAL PRIMARY KEY,
    social_post_id INTEGER REFERENCES social_posts(id),
    platform VARCHAR(50) NOT NULL, -- instagram, facebook, linkedin, twitter
    platform_post_id VARCHAR(255), -- ID from the platform
    post_url TEXT,
    status VARCHAR(50) DEFAULT 'pending', -- pending, published, failed
    published_at TIMESTAMP,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Blog Posts (from CRM)
CREATE TABLE blog_posts (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(255) UNIQUE,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    category VARCHAR(100),
    tags TEXT[],
    featured_image_url TEXT,
    seo_keywords TEXT[],
    internal_links TEXT[],
    social_caption TEXT,
    status VARCHAR(50) DEFAULT 'draft', -- draft, scheduled, published
    scheduled_at TIMESTAMP,
    published_at TIMESTAMP,
    published_to_website BOOLEAN DEFAULT false,
    website_url TEXT,
    auto_share_social BOOLEAN DEFAULT true,
    views_count INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email Templates
CREATE TABLE email_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(500),
    body_html TEXT,
    body_text TEXT,
    category VARCHAR(100), -- property_listing, newsletter, follow_up, welcome
    variables TEXT[], -- Available variables like {name}, {property_title}, etc.
    thumbnail_url TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- WhatsApp Templates
CREATE TABLE whatsapp_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    category VARCHAR(100), -- property_listing, follow_up, greeting, reminder
    variables TEXT[], -- Available variables
    media_type VARCHAR(50), -- none, image, video, document
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Marketing Segments (for targeting)
CREATE TABLE marketing_segments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    criteria JSONB, -- Filter criteria: budget, location, property_type, etc.
    contacts_count INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Content Library
CREATE TABLE content_library (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    file_type VARCHAR(50), -- image, video, pdf, template
    file_url TEXT NOT NULL,
    file_size INTEGER,
    category VARCHAR(100), -- property_photos, marketing, branding, documents
    tags TEXT[],
    description TEXT,
    uploaded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_contacts_phone ON contacts(phone);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_assigned ON contacts(assigned_to);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_assigned ON leads(assigned_to);
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_viewings_scheduled ON viewings(scheduled_at);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_activity_log_user ON activity_log(user_id);
CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON deals 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_viewings_updated_at BEFORE UPDATE ON viewings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_commissions_updated_at BEFORE UPDATE ON commissions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
