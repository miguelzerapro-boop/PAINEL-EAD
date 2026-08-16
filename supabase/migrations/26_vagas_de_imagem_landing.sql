-- ===========================================================================
-- 26 - VAGAS DE IMAGEM DA LANDING
--
-- A landing passou a ter composicao fotografica. Estas sao as vagas que
-- precisam de foto real do universo da manicure.
--
-- Enquanto `media_id` estiver nulo, a pagina mostra uma ARTE EDITORIAL
-- TEMPORARIA (ilustracao de unhas, sem pessoa identificavel). Assim que a
-- responsavel enviar a foto pelo painel, a arte sai e a foto entra — sem
-- tocar em codigo.
--
-- REGRA QUE CONTINUA VALENDO: nenhuma destas vagas admite rosto gerado por IA
-- apresentado como instrutora ou aluna. O campo `casting_notes` registra isso
-- em cada linha, para quem for produzir o ensaio ler antes.
-- ===========================================================================

insert into public.image_slots (
  key, group_key, name, purpose,
  recommended_width, recommended_height, aspect_ratio, orientation, min_width,
  framing_notes, lighting_notes, scene_notes, casting_notes,
  is_required, status
) values
  (
    'landing.hero',
    'landing',
    'Primeira dobra — composicao principal',
    'Ocupa o lado direito do heroi e sangra para o fundo. E a primeira coisa que a visitante ve.',
    1800, 2200, '9:11', 'vertical', 1200,
    'Macro ou meio-macro de maos com unhas esmaltadas. Enquadramento vertical, espaco negativo no alto para o degrade escuro.',
    'Luz lateral suave com uma fonte quente. Evitar flash direto e sombra dura.',
    'Fundo escuro e neutro. A cor deve vir do esmalte, nao do cenario.',
    'Sem rosto. Somente maos. Se houver pessoa real, exige autorizacao de uso registrada. NUNCA usar rosto ou mao gerados por IA como se fossem de aluna ou instrutora.',
    true, 'pending'
  ),
  (
    'landing.acabamento',
    'landing',
    'Detalhe do acabamento',
    'Faixa fotografica no meio da pagina, ao lado do texto sobre precisao do trabalho.',
    2400, 1800, '4:3', 'horizontal', 1600,
    'Macro de uma unha pronta: cuticula limpa, esmalte uniforme, borda definida.',
    'Luz difusa e proxima. O brilho do verniz precisa aparecer.',
    'Sem cenario. O assunto e o acabamento.',
    'Sem rosto. Somente maos. Mesma regra de autorizacao.',
    true, 'pending'
  ),
  (
    'landing.bancada',
    'landing',
    'Bancada de trabalho',
    'Bloco de impacto: os instrumentos da profissao.',
    2400, 1800, '4:3', 'horizontal', 1600,
    'Vista de cima ou tres-quartos da bancada com vidros de esmalte, alicate, lixa e palito organizados.',
    'Luz lateral baixa, para o metal ter reflexo.',
    'Bancada real de atendimento. Organizada, sem excesso de objetos.',
    'Sem pessoas.',
    false, 'pending'
  )
on conflict (key) do nothing;
