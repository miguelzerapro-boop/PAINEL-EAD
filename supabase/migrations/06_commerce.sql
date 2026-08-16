-- ===========================================================================
-- 06 - COMERCIO (produtos, ofertas, cupons, pedidos, Mercado Pago)
--
-- Nenhum preco, bonus, garantia ou prazo esta definido. Toda oferta nasce em
-- rascunho com price_cents nulo e so pode ser publicada depois de preenchida.
-- ===========================================================================

create table public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  kind        text not null default 'course'
              check (kind in ('course', 'bundle', 'subscription')),
  status      public.publication_status not null default 'draft',
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.tg_set_updated_at();

-- Liga o curso ao produto que da acesso a ele.
alter table public.courses
  add constraint courses_product_fk
  foreign key (product_id) references public.products (id) on delete set null;

-- Um produto pode liberar varios cursos (combo).
create table public.product_courses (
  product_id uuid not null references public.products (id) on delete cascade,
  course_id  uuid not null references public.courses (id) on delete cascade,
  position   integer not null default 0,
  primary key (product_id, course_id)
);

-- ---------------------------------------------------------------------------
-- Ofertas
-- price_cents e NULL enquanto o preco nao for definido. A constraint impede
-- publicar uma oferta sem preco, o que impede a landing exibir preco inventado.
-- ---------------------------------------------------------------------------
create table public.offers (
  id                  uuid primary key default gen_random_uuid(),
  product_id          uuid not null references public.products (id) on delete cascade,
  name                text not null,
  slug                text not null unique,

  price_cents         integer check (price_cents is null or price_cents >= 0),
  compare_at_cents    integer check (compare_at_cents is null or compare_at_cents >= 0),
  currency            text not null default 'BRL',
  max_installments    integer check (max_installments is null or max_installments between 1 and 12),

  -- Texto comercial editavel. Vazio = a secao correspondente nao renderiza.
  headline            text,
  subheadline         text,
  cta_label           text,
  bullets             jsonb not null default '[]'::jsonb,
  guarantee_text      text,       -- garantia: so aparece se preenchida
  bonus               jsonb not null default '[]'::jsonb,
  access_note         text,       -- prazo de acesso em texto comercial

  starts_at           timestamptz,
  ends_at             timestamptz,
  seats_total         integer check (seats_total is null or seats_total > 0),
  seats_taken         integer not null default 0,

  status              public.publication_status not null default 'draft',
  is_demo             boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint offers_publish_requires_price check (
    status <> 'published' or price_cents is not null
  )
);

comment on constraint offers_publish_requires_price on public.offers is
  'Impede que uma oferta va ao ar sem preco definido. Preco inventado e proibido pelo escopo.';

create index offers_product_idx on public.offers (product_id, status);

create trigger offers_set_updated_at
  before update on public.offers
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- Cupons
-- ---------------------------------------------------------------------------
create table public.coupons (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  description   text,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric(10, 2) not null check (discount_value > 0),
  offer_id      uuid references public.offers (id) on delete cascade,
  max_uses      integer check (max_uses is null or max_uses > 0),
  uses          integer not null default 0,
  starts_at     timestamptz,
  ends_at       timestamptz,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger coupons_set_updated_at
  before update on public.coupons
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------------
create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  reference         text not null unique default encode(gen_random_bytes(9), 'hex'),

  user_id           uuid references public.profiles (id) on delete set null,
  lead_id           uuid,                       -- FK adicionada na migration de funil
  offer_id          uuid references public.offers (id) on delete set null,
  product_id        uuid references public.products (id) on delete set null,
  coupon_id         uuid references public.coupons (id) on delete set null,

  status            public.order_status not null default 'pending',
  amount_cents      integer not null check (amount_cents >= 0),
  discount_cents    integer not null default 0 check (discount_cents >= 0),
  currency          text not null default 'BRL',

  -- Dados do pagador informados no checkout (minimo necessario - LGPD).
  buyer_name        text,
  buyer_email       text,
  buyer_document    text,
  buyer_phone       text,

  utm               jsonb not null default '{}'::jsonb,
  metadata          jsonb not null default '{}'::jsonb,

  paid_at           timestamptz,
  cancelled_at      timestamptz,
  refunded_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index orders_user_idx on public.orders (user_id);
create index orders_status_idx on public.orders (status, created_at desc);
create index orders_email_idx on public.orders (lower(buyer_email));

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.tg_set_updated_at();

alter table public.enrollments
  add constraint enrollments_order_fk
  foreign key (order_id) references public.orders (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Pagamentos (Mercado Pago)
-- ---------------------------------------------------------------------------
create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders (id) on delete cascade,
  provider            text not null default 'mercadopago',
  provider_payment_id text,
  provider_preference_id text,
  status              public.order_status not null default 'pending',
  status_detail       text,
  method              text,          -- pix, credit_card, boleto...
  installments        integer,
  amount_cents        integer not null check (amount_cents >= 0),
  fee_cents           integer,
  net_cents           integer,
  payer               jsonb not null default '{}'::jsonb,
  raw                 jsonb not null default '{}'::jsonb,
  approved_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (provider, provider_payment_id)
);

create index payments_order_idx on public.payments (order_id);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- Webhooks recebidos. Chave unica garante idempotencia: o Mercado Pago
-- reenvia notificacoes e a matricula nunca pode ser criada duas vezes.
-- ---------------------------------------------------------------------------
create table public.payment_webhook_events (
  id             uuid primary key default gen_random_uuid(),
  provider       text not null default 'mercadopago',
  event_key      text not null,       -- id do recurso + acao
  event_type     text,
  signature_ok   boolean not null default false,
  payload        jsonb not null,
  received_at    timestamptz not null default now(),
  processed_at   timestamptz,
  error          text,
  attempts       integer not null default 0,
  unique (provider, event_key)
);

create index payment_webhook_pending_idx on public.payment_webhook_events (received_at)
  where processed_at is null;
