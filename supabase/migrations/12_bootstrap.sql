-- ===========================================================================
-- 12 - BOOTSTRAP ESTRUTURAL
--
-- Aqui entram apenas ESTRUTURAS: quais chaves de configuracao existem, quais
-- tipos de bloco o CMS conhece, quais fotos precisam ser produzidas e o
-- esqueleto das paginas.
--
-- Nenhum texto de venda, nenhuma promessa, nenhum dado da instrutora, nenhum
-- preco. Tudo entra com valor nulo e status 'draft': o site publico so mostra
-- o que a responsavel preencher.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Chaves de configuracao. value = null significa PENDENTE.
-- ---------------------------------------------------------------------------
insert into public.settings (key, group_key, label, description, value, is_required, is_secret) values
  ('site.name',            'site',    'Nome do site',                 'Aparece no titulo do navegador e no rodape.', null, true,  false),
  ('site.tagline',         'site',    'Frase de apoio',               'Uma linha curta. Nao inventar promessa.',      null, false, false),
  ('site.logo_media_id',   'site',    'Logotipo',                     'Enviar quando a identidade oficial existir.', null, true,  false),
  ('contact.whatsapp',     'contact', 'Numero de WhatsApp',           'Formato internacional, so digitos.',          null, true,  false),
  ('contact.email',        'contact', 'E-mail de contato',            null,                                          null, true,  false),
  ('contact.instagram',    'contact', 'Instagram',                    null,                                          null, false, false),
  ('contact.hours',        'contact', 'Horario de atendimento',       null,                                          null, false, false),
  ('legal.company_name',   'legal',   'Razao social',                 'Obrigatorio no rodape e no checkout.',        null, true,  false),
  ('legal.tax_id',         'legal',   'CNPJ ou CPF',                  null,                                          null, true,  false),
  ('legal.address',        'legal',   'Endereco',                     null,                                          null, true,  false),
  ('legal.terms',          'legal',   'Termos de uso',                'Texto completo.',                             null, true,  false),
  ('legal.privacy',        'legal',   'Politica de privacidade',      'Texto completo, exigido pela LGPD.',          null, true,  false),
  ('legal.refund',         'legal',   'Politica de reembolso',        'So publicar depois de definida.',             null, true,  false),
  ('legal.dpo_contact',    'legal',   'Contato do encarregado (LGPD)',null,                                          null, true,  false),
  ('seo.default_title',    'seo',     'Titulo padrao',                null,                                          null, true,  false),
  ('seo.default_description','seo',   'Descricao padrao',             null,                                          null, true,  false),
  ('seo.og_image_media_id','seo',     'Imagem de compartilhamento',   '1200x630.',                                   null, true,  false),
  ('checkout.support_note','checkout','Aviso de suporte no checkout', null,                                          null, false, false);

-- ---------------------------------------------------------------------------
-- Politica de retencao (LGPD)
-- ---------------------------------------------------------------------------
insert into public.retention_policies (entity, label, retention_days, legal_basis, note) values
  ('leads',             'Leads sem conversao',       730, 'legitimo interesse', 'Revisar anualmente.'),
  ('quiz_responses',    'Respostas do diagnostico',  730, 'consentimento',      null),
  ('analytics_events',  'Eventos de navegacao',      395, 'legitimo interesse', 'Sem dado sensivel.'),
  ('orders',            'Pedidos e pagamentos',     1825, 'obrigacao legal',    'Fiscal: 5 anos.'),
  ('audit_log',         'Log de auditoria',          730, 'legitimo interesse', null);

-- ---------------------------------------------------------------------------
-- Tipos de bloco do CMS
-- required_fields alimenta o trigger que impede publicar bloco incompleto.
-- needs_real_data marca blocos que dependem de informacao que so a
-- responsavel pode fornecer.
-- ---------------------------------------------------------------------------
insert into public.cms_block_types (key, name, description, category, field_schema, required_fields, needs_real_data, position) values
  ('hero', 'Abertura', 'Primeira dobra da pagina.', 'landing',
   '{"eyebrow":{"type":"text","label":"Chapeu"},"title":{"type":"text","label":"Titulo","required":true},"lead":{"type":"textarea","label":"Texto de apoio","required":true},"cta_label":{"type":"text","label":"Texto do botao","required":true},"cta_href":{"type":"text","label":"Destino do botao","required":true},"media_slot":{"type":"image_slot","label":"Foto"}}'::jsonb,
   '{title,lead,cta_label,cta_href}', false, 10),

  ('diagnostic_invite', 'Convite ao diagnostico', 'Chamada para o quiz.', 'landing',
   '{"title":{"type":"text","required":true},"lead":{"type":"textarea"},"cta_label":{"type":"text","required":true}}'::jsonb,
   '{title,cta_label}', false, 20),

  ('editorial_text', 'Texto editorial', 'Bloco de texto longo com titulo.', 'content',
   '{"title":{"type":"text"},"body":{"type":"richtext","required":true}}'::jsonb,
   '{body}', false, 30),

  ('instructor_intro', 'Apresentacao da instrutora', 'Puxa os dados cadastrados em Instrutoras.', 'landing',
   '{"instructor_id":{"type":"reference","entity":"instructors","required":true},"title":{"type":"text"},"lead":{"type":"textarea"}}'::jsonb,
   '{instructor_id}', true, 40),

  ('course_showcase', 'Vitrine de cursos', 'Renderiza somente cursos publicados. Fica oculto se nao houver nenhum.', 'landing',
   '{"title":{"type":"text"},"category_id":{"type":"reference","entity":"course_categories"},"limit":{"type":"number"}}'::jsonb,
   '{}', false, 50),

  ('curriculum', 'Grade do curso', 'Monta modulos e aulas a partir do curso cadastrado.', 'sales',
   '{"course_id":{"type":"reference","entity":"courses","required":true},"title":{"type":"text"}}'::jsonb,
   '{course_id}', false, 60),

  ('offer_details', 'Detalhes da oferta', 'Preco, parcelas e condicoes. Exige oferta com preco definido.', 'sales',
   '{"offer_id":{"type":"reference","entity":"offers","required":true},"title":{"type":"text"}}'::jsonb,
   '{offer_id}', true, 70),

  ('guarantee', 'Garantia', 'So publicar apos a politica de reembolso existir.', 'sales',
   '{"title":{"type":"text","required":true},"body":{"type":"textarea","required":true}}'::jsonb,
   '{title,body}', true, 80),

  ('testimonials', 'Depoimentos', 'Renderiza apenas depoimentos verificados e autorizados.', 'social',
   '{"title":{"type":"text"},"limit":{"type":"number"}}'::jsonb,
   '{}', true, 90),

  ('metrics', 'Numeros', 'Renderiza apenas metricas com fonte e data.', 'social',
   '{"title":{"type":"text"},"metric_keys":{"type":"list"}}'::jsonb,
   '{}', true, 100),

  ('gallery', 'Galeria de trabalhos', 'Portfolio. Usa apenas fotos proprias aprovadas.', 'content',
   '{"title":{"type":"text"},"media_ids":{"type":"media_list","required":true}}'::jsonb,
   '{media_ids}', true, 110),

  ('faq', 'Perguntas frequentes', 'Puxa as perguntas cadastradas.', 'content',
   '{"title":{"type":"text"},"scope":{"type":"select","options":["global","landing","sales","checkout"]}}'::jsonb,
   '{}', false, 120),

  ('whatsapp_cta', 'Chamada para WhatsApp', 'Depende de contact.whatsapp preenchido.', 'conversion',
   '{"title":{"type":"text","required":true},"lead":{"type":"textarea"},"cta_label":{"type":"text","required":true},"message":{"type":"textarea"}}'::jsonb,
   '{title,cta_label}', false, 130),

  ('media_editorial', 'Imagem editorial', 'Imagem grande com legenda. Usa vaga de foto.', 'content',
   '{"media_slot":{"type":"image_slot","required":true},"caption":{"type":"text"}}'::jsonb,
   '{media_slot}', false, 140),

  ('legal_text', 'Texto legal', 'Termos, privacidade, reembolso.', 'legal',
   '{"title":{"type":"text","required":true},"body":{"type":"richtext","required":true}}'::jsonb,
   '{title,body}', false, 150);

-- ---------------------------------------------------------------------------
-- Paginas do sistema. Todas nascem em rascunho.
-- ---------------------------------------------------------------------------
insert into public.cms_pages (key, name, path, type, status, is_system) values
  ('home',       'Landing do diagnostico', '/',              'landing', 'draft', true),
  ('quiz',       'Quiz',                   '/diagnostico',   'quiz',    'draft', true),
  ('quiz_result','Resultado do quiz',      '/diagnostico/resultado', 'result', 'draft', true),
  ('sales',      'Pagina de vendas',       '/inscricao',     'sales',   'draft', true),
  ('thanks',     'Obrigado',               '/obrigado',      'thanks',  'draft', true),
  ('terms',      'Termos de uso',          '/termos',        'legal',   'draft', true),
  ('privacy',    'Politica de privacidade','/privacidade',   'legal',   'draft', true),
  ('refund',     'Politica de reembolso',  '/reembolso',     'legal',   'draft', true);

-- ---------------------------------------------------------------------------
-- Lista de producao fotografica
-- Nenhuma dessas fotos existe. status='pending' faz a interface renderizar
-- placeholder identificado em vez de foto de banco.
-- A coluna art_direction fica nula ate a direcao visual ser fechada.
-- ---------------------------------------------------------------------------
insert into public.image_slots
  (key, group_key, name, purpose, recommended_width, recommended_height, aspect_ratio, orientation, min_width, framing_notes, is_required)
values
  ('hero.principal',        'landing',    'Foto principal da abertura',      'Primeira dobra da landing.',                 2400, 1600, '3:2',  'horizontal', 1600, 'Espaco livre a esquerda para o titulo respirar.', true),
  ('hero.mobile',           'landing',    'Recorte vertical da abertura',    'Mesma cena, enquadrada para celular.',       1200, 1600, '3:4',  'vertical',   1000, 'Recorte proprio, nao apenas crop automatico.',     true),
  ('instrutora.retrato',    'instrutora', 'Retrato da instrutora',           'Bloco de apresentacao e pagina de vendas.',  1400, 1750, '4:5',  'vertical',   1000, 'Meio corpo, olhar para a camera.',                 true),
  ('instrutora.trabalhando','instrutora', 'Instrutora trabalhando',          'Prova de pratica real.',                     2400, 1600, '3:2',  'horizontal', 1600, 'Maos em acao, rosto parcialmente visivel.',        true),
  ('instrutora.ensinando',  'instrutora', 'Instrutora ensinando',            'Relacao instrutora e aluna.',                2400, 1600, '3:2',  'horizontal', 1600, 'Duas pessoas, gesto de orientacao.',               true),
  ('detalhe.maos',          'detalhe',    'Detalhe das maos',                'Precisao e acabamento.',                     2000, 2000, '1:1',  'square',     1400, 'Macro. Foco no ponto de contato da ferramenta.',   true),
  ('detalhe.camadas',       'detalhe',    'Detalhe de camadas',              'Etapas do acabamento.',                      2000, 2000, '1:1',  'square',     1400, 'Sequencia de 3 a 5 frames do mesmo angulo.',       true),
  ('bancada.geral',         'ambiente',   'Bancada montada',                 'Organizacao e profissionalismo.',            2400, 1600, '3:2',  'horizontal', 1600, 'Vista de cima, instrumentos organizados.',         true),
  ('bancada.materiais',     'ambiente',   'Materiais e instrumentos',        'Lista de materiais necessarios.',            2000, 2000, '1:1',  'square',     1400, 'Fundo neutro, itens separados e nomeaveis.',       true),
  ('ambiente.espaco',       'ambiente',   'Ambiente de atendimento',         'Contexto do espaco.',                        2400, 1350, '16:9', 'horizontal', 1600, 'Plano aberto, luz natural.',                       false),
  ('ambiente.gravacao',     'ambiente',   'Bastidor da gravacao',            'Mostra como as aulas sao produzidas.',       2400, 1600, '3:2',  'horizontal', 1600, 'Camera, luz e bancada no mesmo quadro.',           false),
  ('portfolio.trabalho.1',  'portfolio',  'Trabalho real 1',                 'Galeria de trabalhos.',                      1600, 2000, '4:5',  'vertical',   1200, 'Mao inteira, fundo neutro.',                       true),
  ('portfolio.trabalho.2',  'portfolio',  'Trabalho real 2',                 'Galeria de trabalhos.',                      1600, 2000, '4:5',  'vertical',   1200, 'Angulo diferente do anterior.',                    true),
  ('portfolio.trabalho.3',  'portfolio',  'Trabalho real 3',                 'Galeria de trabalhos.',                      1600, 2000, '4:5',  'vertical',   1200, 'Detalhe aproximado.',                              false),
  ('portfolio.antes_depois','portfolio',  'Evolucao pratica',                'Progresso, nao promessa de resultado.',      2000, 1200, '5:3',  'horizontal', 1400, 'Mesma mao, mesma luz, mesmo angulo.',              false),
  ('aluna.retrato.1',       'alunas',     'Aluna real 1',                    'Depoimento. Exige autorizacao de imagem.',   1400, 1750, '4:5',  'vertical',   1000, 'Somente com consentimento registrado.',            false),
  ('aluna.pratica',         'alunas',     'Aluna praticando',                'Prova social honesta.',                      2400, 1600, '3:2',  'horizontal', 1600, 'Somente com consentimento registrado.',            false),
  ('curso.capa.padrao',     'ead',        'Capa padrao de curso',            'Fallback quando o curso nao tiver capa.',    1600,  900, '16:9', 'horizontal', 1200, 'Composicao neutra, sem texto embutido.',           true),
  ('ead.boas_vindas',       'ead',        'Abertura da area da aluna',       'Topo do painel da aluna.',                   2400,  900, '8:3',  'horizontal', 1600, 'Faixa larga, muito espaco negativo.',              false),
  ('og.compartilhamento',   'seo',        'Imagem de compartilhamento',      'Link no WhatsApp e redes.',                  1200,  630, '1.91:1','horizontal',1200, 'Sem texto pequeno. Legivel em miniatura.',         true);

-- ---------------------------------------------------------------------------
-- Quiz de diagnostico
-- Os cinco resultados sao MOMENTOS da pessoa, autorizados no escopo.
-- Nenhum aponta para curso: preferred_target='auto' resolve contra o banco e,
-- sem curso publicado, cai no WhatsApp com a mensagem oficial.
-- As PERGUNTAS ainda nao foram definidas e devem ser cadastradas no painel.
-- ---------------------------------------------------------------------------
insert into public.quizzes (slug, name, fallback_message, status, consent_text)
values (
  'diagnostico',
  'Diagnostico inicial',
  'Seu diagnostico foi concluido. Nossa equipe vai conversar com voce pelo WhatsApp para entender melhor seu momento e apresentar as opcoes disponiveis.',
  'draft',
  null
);

insert into public.quiz_outcomes (quiz_id, key, name, description, preferred_target, position)
select q.id, v.key, v.name, v.description, 'auto', v.position
from public.quizzes q,
(values
  ('comecar_do_zero',   'Quero comecar do zero',            null, 10),
  ('praticar_evoluir',  'Ja pratico e quero evoluir',       null, 20),
  ('ja_trabalho',       'Ja trabalho na area',              null, 30),
  ('organizar_carreira','Quero organizar minha carreira',   null, 40),
  ('pesquisando',       'Ainda estou pesquisando',          null, 50)
) as v(key, name, description, position)
where q.slug = 'diagnostico';
