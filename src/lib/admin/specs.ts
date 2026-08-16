/**
 * Especificação das entidades editáveis pelo painel.
 *
 * Um único formulário genérico é montado a partir daqui. Isso evita repetir
 * oito formulários quase iguais e, principalmente, garante que a lista de
 * campos do escopo esteja em UM lugar auditável.
 *
 * A ação do servidor só aceita tabelas presentes neste mapa — a whitelist é
 * definida no servidor, nunca vinda do formulário.
 */

export type TipoCampo =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'datetime'
  | 'checkbox'
  | 'select'
  | 'reference'

export type CampoSpec = {
  nome: string
  rotulo: string
  tipo: TipoCampo
  dica?: string
  obrigatorio?: boolean
  opcoes?: Array<{ value: string; label: string }>
  /** Para tipo 'reference': tabela de origem e coluna usada como rótulo. */
  referencia?: { tabela: string; rotulo: string }
}

export type EntidadeSpec = {
  tabela: string
  titulo: string
  singular: string
  /** Coluna usada como título na listagem. */
  colunaTitulo: string
  /** Coluna de ordenação da listagem. */
  ordem: string
  /** FK para o pai, quando a entidade é filha (módulo → curso, aula → módulo). */
  pai?: { coluna: string; entidade: string }
  aviso?: string
  campos: CampoSpec[]
}

const STATUS: CampoSpec = {
  nome: 'status',
  rotulo: 'Situação',
  tipo: 'select',
  opcoes: [
    { value: 'draft', label: 'Rascunho — invisível no site' },
    { value: 'scheduled', label: 'Agendado' },
    { value: 'published', label: 'Publicado' },
    { value: 'archived', label: 'Arquivado' },
  ],
}

const POSICAO: CampoSpec = {
  nome: 'position',
  rotulo: 'Ordem',
  tipo: 'number',
  dica: 'Menor número aparece primeiro.',
}

const LIBERACAO: CampoSpec[] = [
  {
    nome: 'release_mode',
    rotulo: 'Liberação',
    tipo: 'select',
    opcoes: [
      { value: 'immediate', label: 'Imediata' },
      { value: 'after_previous_module', label: 'Após concluir o módulo anterior' },
      { value: 'after_previous_lesson', label: 'Após concluir a aula anterior' },
      { value: 'on_date', label: 'Em uma data' },
      { value: 'days_after_enrollment', label: 'N dias após a matrícula' },
      { value: 'manual', label: 'Manual (liberada pela instrutora)' },
      { value: 'by_cohort', label: 'Por turma' },
    ],
  },
  { nome: 'release_at', rotulo: 'Data de liberação', tipo: 'datetime', dica: 'Só para "Em uma data".' },
  { nome: 'release_days', rotulo: 'Dias após a matrícula', tipo: 'number', dica: 'Só para "N dias".' },
]

export const ENTIDADES: Record<string, EntidadeSpec> = {
  /* ---------------------------------------------------------------------- */
  modulos: {
    tabela: 'modules',
    titulo: 'Módulos',
    singular: 'Módulo',
    colunaTitulo: 'name',
    ordem: 'position',
    pai: { coluna: 'course_id', entidade: 'cursos' },
    campos: [
      { nome: 'name', rotulo: 'Nome', tipo: 'text', obrigatorio: true },
      { nome: 'slug', rotulo: 'Endereço (slug)', tipo: 'text' },
      { nome: 'description', rotulo: 'Descrição', tipo: 'textarea' },
      POSICAO,
      ...LIBERACAO,
      {
        nome: 'prerequisite_module_id',
        rotulo: 'Pré-requisito',
        tipo: 'reference',
        referencia: { tabela: 'modules', rotulo: 'name' },
        dica: 'Módulo que precisa estar concluído antes deste.',
      },
      STATUS,
      { nome: 'published_at', rotulo: 'Data de publicação', tipo: 'datetime' },
    ],
  },

  /* ---------------------------------------------------------------------- */
  aulas: {
    tabela: 'lessons',
    titulo: 'Aulas',
    singular: 'Aula',
    colunaTitulo: 'title',
    ordem: 'position',
    pai: { coluna: 'module_id', entidade: 'modulos' },
    campos: [
      { nome: 'title', rotulo: 'Título', tipo: 'text', obrigatorio: true },
      { nome: 'slug', rotulo: 'Endereço (slug)', tipo: 'text' },
      { nome: 'description', rotulo: 'Descrição', tipo: 'textarea' },
      {
        nome: 'content_type',
        rotulo: 'Tipo de conteúdo',
        tipo: 'select',
        opcoes: [
          { value: 'video', label: 'Vídeo' },
          { value: 'text', label: 'Texto' },
          { value: 'audio', label: 'Áudio' },
          { value: 'pdf', label: 'PDF' },
          { value: 'image', label: 'Imagem' },
          { value: 'download', label: 'Download' },
          { value: 'link', label: 'Link' },
          { value: 'live', label: 'Aula ao vivo' },
          { value: 'quiz', label: 'Quiz' },
          { value: 'practice', label: 'Atividade prática' },
          { value: 'form', label: 'Formulário' },
          { value: 'embed', label: 'Conteúdo incorporado' },
        ],
      },
      {
        nome: 'video_provider',
        rotulo: 'Origem do vídeo',
        tipo: 'select',
        opcoes: [
          { value: 'upload', label: 'Arquivo enviado' },
          { value: 'youtube', label: 'YouTube' },
          { value: 'vimeo', label: 'Vimeo' },
          { value: 'panda', label: 'Panda Video' },
          { value: 'bunny', label: 'Bunny' },
          { value: 'other', label: 'Outro' },
        ],
      },
      { nome: 'video_url', rotulo: 'Endereço do vídeo', tipo: 'text' },
      { nome: 'audio_url', rotulo: 'Endereço do áudio', tipo: 'text' },
      { nome: 'body', rotulo: 'Texto da aula', tipo: 'textarea', dica: 'Separe parágrafos com linha em branco.' },
      { nome: 'transcript', rotulo: 'Transcrição', tipo: 'textarea', dica: 'Melhora acessibilidade e busca.' },
      {
        nome: 'duration_seconds',
        rotulo: 'Duração (segundos)',
        tipo: 'number',
        dica: 'Deixe vazio se ainda não souber. Vazio não aparece para a aluna.',
      },
      POSICAO,
      { nome: 'is_free', rotulo: 'Aula gratuita (degustação)', tipo: 'checkbox' },
      ...LIBERACAO,
      {
        nome: 'prerequisite_lesson_id',
        rotulo: 'Pré-requisito',
        tipo: 'reference',
        referencia: { tabela: 'lessons', rotulo: 'title' },
      },
      { nome: 'live_starts_at', rotulo: 'Início da transmissão', tipo: 'datetime' },
      { nome: 'live_url', rotulo: 'Link da transmissão', tipo: 'text' },
      { nome: 'live_replay_url', rotulo: 'Link da gravação', tipo: 'text' },
      STATUS,
      { nome: 'published_at', rotulo: 'Data de publicação', tipo: 'datetime' },
    ],
  },

  /* ---------------------------------------------------------------------- */
  'perguntas-quiz': {
    tabela: 'quiz_questions',
    titulo: 'Perguntas do diagnóstico',
    singular: 'Pergunta',
    colunaTitulo: 'prompt',
    ordem: 'position',
    pai: { coluna: 'quiz_id', entidade: 'quiz' },
    aviso:
      'Editar aqui altera o rascunho. A mudança só vai ao ar quando você publicar o diagnóstico em Diagnóstico → Publicar.',
    campos: [
      { nome: 'prompt', rotulo: 'Pergunta', tipo: 'textarea', obrigatorio: true },
      { nome: 'help_text', rotulo: 'Texto de apoio', tipo: 'text' },
      {
        nome: 'type',
        rotulo: 'Tipo',
        tipo: 'select',
        obrigatorio: true,
        opcoes: [
          { value: 'single', label: 'Escolha única' },
          { value: 'multiple', label: 'Múltipla escolha' },
          { value: 'scale', label: 'Escala' },
          { value: 'text', label: 'Texto livre' },
        ],
      },
      { nome: 'is_required', rotulo: 'Resposta obrigatória', tipo: 'checkbox' },
      { nome: 'min_selections', rotulo: 'Mínimo de seleções', tipo: 'number' },
      {
        nome: 'max_selections',
        rotulo: 'Máximo de seleções',
        tipo: 'number',
        dica: 'Só para múltipla escolha. Vazio = sem limite.',
      },
      POSICAO,
      STATUS,
    ],
  },

  'opcoes-quiz': {
    tabela: 'quiz_options',
    titulo: 'Alternativas',
    singular: 'Alternativa',
    colunaTitulo: 'label',
    ordem: 'position',
    pai: { coluna: 'question_id', entidade: 'perguntas-quiz' },
    aviso:
      'O campo "Pesos" liga a alternativa aos resultados do diagnóstico. Exemplo: {"praticar_evoluir": 3, "comecar_do_zero": 1}. Recalibrar a segmentação é só mudar esses números.',
    campos: [
      { nome: 'label', rotulo: 'Texto da alternativa', tipo: 'text', obrigatorio: true },
      {
        nome: 'value',
        rotulo: 'Valor interno',
        tipo: 'text',
        obrigatorio: true,
        dica: 'Identificador estável. Não mude depois que o diagnóstico estiver no ar.',
      },
      { nome: 'help_text', rotulo: 'Texto de apoio', tipo: 'text' },
      {
        nome: 'weights',
        rotulo: 'Pesos por resultado (JSON)',
        tipo: 'textarea',
        dica: 'Chaves possíveis: comecar_do_zero, praticar_evoluir, ja_trabalho, organizar_carreira, pesquisando.',
      },
      POSICAO,
    ],
  },

  'resultados-quiz': {
    tabela: 'quiz_outcomes',
    titulo: 'Resultados do diagnóstico',
    singular: 'Resultado',
    colunaTitulo: 'name',
    ordem: 'position',
    pai: { coluna: 'quiz_id', entidade: 'quiz' },
    aviso:
      'O destino é resolvido contra o banco na hora: curso publicado → oferta ativa → página → WhatsApp. Sem nada disso, a pessoa recebe a mensagem de encaminhamento. Nunca é exibida uma trilha inexistente.',
    campos: [
      { nome: 'name', rotulo: 'Nome do momento', tipo: 'text', obrigatorio: true },
      { nome: 'key', rotulo: 'Chave interna', tipo: 'text', obrigatorio: true },
      { nome: 'description', rotulo: 'Descrição', tipo: 'textarea' },
      {
        nome: 'preferred_target',
        rotulo: 'Destino preferido',
        tipo: 'select',
        opcoes: [
          { value: 'auto', label: 'Automático (curso → oferta → página → WhatsApp)' },
          { value: 'course', label: 'Sempre um curso' },
          { value: 'offer', label: 'Sempre uma oferta' },
          { value: 'page', label: 'Sempre uma página' },
          { value: 'whatsapp', label: 'Sempre WhatsApp' },
        ],
      },
      {
        nome: 'course_id',
        rotulo: 'Curso',
        tipo: 'reference',
        referencia: { tabela: 'courses', rotulo: 'name' },
      },
      {
        nome: 'offer_id',
        rotulo: 'Oferta',
        tipo: 'reference',
        referencia: { tabela: 'offers', rotulo: 'name' },
      },
      { nome: 'target_path', rotulo: 'Página específica', tipo: 'text', dica: 'Ex.: /inscricao' },
      { nome: 'whatsapp_message', rotulo: 'Mensagem do WhatsApp', tipo: 'textarea' },
      POSICAO,
    ],
  },

  /* ---------------------------------------------------------------------- */
  biblioteca: {
    tabela: 'library_materials',
    titulo: 'Biblioteca',
    singular: 'Material',
    colunaTitulo: 'title',
    ordem: 'position',
    aviso:
      'Material sem arquivo e sem descrição não pode ser publicado — a constraint do banco recusa. O arquivo vai para o bucket privado e sai por URL assinada, nunca por link público.',
    campos: [
      { nome: 'title', rotulo: 'Título', tipo: 'text', obrigatorio: true },
      { nome: 'slug', rotulo: 'Endereço (slug)', tipo: 'text', obrigatorio: true },
      { nome: 'description', rotulo: 'Descrição', tipo: 'textarea' },
      {
        nome: 'kind',
        rotulo: 'Tipo',
        tipo: 'select',
        obrigatorio: true,
        opcoes: [
          { value: 'ebook', label: 'E-book' },
          { value: 'apostila', label: 'Apostila' },
          { value: 'guia', label: 'Guia' },
          { value: 'checklist', label: 'Checklist' },
          { value: 'livro', label: 'Livro / recomendação' },
          { value: 'extra', label: 'Material extra' },
        ],
      },
      {
        nome: 'category_id',
        rotulo: 'Categoria',
        tipo: 'reference',
        referencia: { tabela: 'material_categories', rotulo: 'name' },
      },
      {
        nome: 'access',
        rotulo: 'Quem pode acessar',
        tipo: 'select',
        obrigatorio: true,
        opcoes: [
          { value: 'free', label: 'Qualquer aluna cadastrada' },
          { value: 'enrolled', label: 'Quem tem matrícula ativa em qualquer curso' },
          { value: 'course', label: 'Só quem tem matrícula no curso vinculado' },
        ],
      },
      {
        nome: 'course_id',
        rotulo: 'Curso vinculado',
        tipo: 'reference',
        referencia: { tabela: 'courses', rotulo: 'name' },
        dica: 'Obrigatório quando o acesso for "só quem tem matrícula no curso".',
      },
      {
        nome: 'file_path',
        rotulo: 'Caminho do arquivo',
        tipo: 'text',
        dica: 'No bucket lesson-assets. Ex.: biblioteca/guia-inicial.pdf',
      },
      { nome: 'page_count', rotulo: 'Número de páginas', tipo: 'number' },
      { nome: 'download_allowed', rotulo: 'Permitir download', tipo: 'checkbox' },
      POSICAO,
      STATUS,
      { nome: 'published_at', rotulo: 'Data de publicação', tipo: 'datetime' },
    ],
  },

  'categorias-material': {
    tabela: 'material_categories',
    titulo: 'Categorias da biblioteca',
    singular: 'Categoria',
    colunaTitulo: 'name',
    ordem: 'position',
    campos: [
      { nome: 'name', rotulo: 'Nome', tipo: 'text', obrigatorio: true },
      { nome: 'slug', rotulo: 'Endereço (slug)', tipo: 'text', obrigatorio: true },
      { nome: 'description', rotulo: 'Descrição', tipo: 'textarea' },
      POSICAO,
      STATUS,
    ],
  },

  canais: {
    tabela: 'community_channels',
    titulo: 'Canais da comunidade',
    singular: 'Canal',
    colunaTitulo: 'name',
    ordem: 'position',
    aviso:
      'Canal vinculado a um curso só aparece para quem tem matrícula nele. Canal "somente equipe" vira mural de avisos: as alunas leem, mas não publicam.',
    campos: [
      { nome: 'name', rotulo: 'Nome', tipo: 'text', obrigatorio: true },
      { nome: 'slug', rotulo: 'Endereço (slug)', tipo: 'text', obrigatorio: true },
      { nome: 'description', rotulo: 'Descrição', tipo: 'textarea' },
      {
        nome: 'course_id',
        rotulo: 'Curso',
        tipo: 'reference',
        referencia: { tabela: 'courses', rotulo: 'name' },
        dica: 'Vazio = canal geral, visível para todas.',
      },
      { nome: 'somente_equipe', rotulo: 'Só a equipe publica', tipo: 'checkbox' },
      POSICAO,
      STATUS,
    ],
  },

  /* ---------------------------------------------------------------------- */
  instrutoras: {
    tabela: 'instructors',
    titulo: 'Instrutoras',
    singular: 'Instrutora',
    colunaTitulo: 'name',
    ordem: 'position',
    aviso:
      'Preencha apenas com informação fornecida pela própria instrutora. Formação e experiência não podem ser estimadas.',
    campos: [
      { nome: 'name', rotulo: 'Nome', tipo: 'text', obrigatorio: true },
      { nome: 'slug', rotulo: 'Endereço (slug)', tipo: 'text', obrigatorio: true },
      { nome: 'headline', rotulo: 'Frase de apresentação', tipo: 'text' },
      { nome: 'bio_short', rotulo: 'Biografia curta', tipo: 'textarea', dica: 'Sem ela, o bloco não vai ao ar.' },
      { nome: 'bio_full', rotulo: 'Biografia completa', tipo: 'textarea' },
      POSICAO,
      STATUS,
    ],
  },

  /* ---------------------------------------------------------------------- */
  ofertas: {
    tabela: 'offers',
    titulo: 'Ofertas',
    singular: 'Oferta',
    colunaTitulo: 'name',
    ordem: 'created_at',
    aviso:
      'Uma oferta sem preço não pode ser publicada — é o que impede o site de exibir valor inventado.',
    campos: [
      { nome: 'name', rotulo: 'Nome', tipo: 'text', obrigatorio: true },
      { nome: 'slug', rotulo: 'Endereço (slug)', tipo: 'text', obrigatorio: true },
      {
        nome: 'product_id',
        rotulo: 'Produto',
        tipo: 'reference',
        referencia: { tabela: 'products', rotulo: 'name' },
        obrigatorio: true,
      },
      { nome: 'price_cents', rotulo: 'Preço (em centavos)', tipo: 'number', dica: 'Ex.: 49700 = R$ 497,00.' },
      { nome: 'compare_at_cents', rotulo: 'Preço de comparação (centavos)', tipo: 'number' },
      { nome: 'max_installments', rotulo: 'Máximo de parcelas', tipo: 'number' },
      { nome: 'headline', rotulo: 'Chamada', tipo: 'text' },
      { nome: 'subheadline', rotulo: 'Subchamada', tipo: 'text' },
      { nome: 'cta_label', rotulo: 'Texto do botão', tipo: 'text' },
      { nome: 'access_note', rotulo: 'Nota sobre o acesso', tipo: 'text' },
      {
        nome: 'guarantee_text',
        rotulo: 'Garantia',
        tipo: 'textarea',
        dica: 'Só preencha depois que a política de reembolso existir.',
      },
      { nome: 'starts_at', rotulo: 'Início', tipo: 'datetime' },
      { nome: 'ends_at', rotulo: 'Fim', tipo: 'datetime' },
      { nome: 'seats_total', rotulo: 'Vagas', tipo: 'number', dica: 'Só informe se houver limite real.' },
      STATUS,
    ],
  },

  /* ---------------------------------------------------------------------- */
  faq: {
    tabela: 'faqs',
    titulo: 'Perguntas frequentes',
    singular: 'Pergunta',
    colunaTitulo: 'question',
    ordem: 'position',
    campos: [
      { nome: 'question', rotulo: 'Pergunta', tipo: 'text', obrigatorio: true },
      { nome: 'answer', rotulo: 'Resposta', tipo: 'textarea', obrigatorio: true },
      {
        nome: 'scope',
        rotulo: 'Onde aparece',
        tipo: 'select',
        opcoes: [
          { value: 'global', label: 'Todo o site' },
          { value: 'landing', label: 'Landing' },
          { value: 'sales', label: 'Página de vendas' },
          { value: 'checkout', label: 'Checkout' },
          { value: 'course', label: 'Página do curso' },
        ],
      },
      POSICAO,
      STATUS,
    ],
  },

  /* ---------------------------------------------------------------------- */
  avisos: {
    tabela: 'notices',
    titulo: 'Avisos',
    singular: 'Aviso',
    colunaTitulo: 'title',
    ordem: 'starts_at',
    campos: [
      { nome: 'title', rotulo: 'Título', tipo: 'text', obrigatorio: true },
      { nome: 'body', rotulo: 'Texto', tipo: 'textarea', obrigatorio: true },
      {
        nome: 'severity',
        rotulo: 'Tom',
        tipo: 'select',
        opcoes: [
          { value: 'info', label: 'Informação' },
          { value: 'success', label: 'Boa notícia' },
          { value: 'warning', label: 'Atenção' },
          { value: 'urgent', label: 'Urgente' },
        ],
      },
      {
        nome: 'audience',
        rotulo: 'Para quem',
        tipo: 'select',
        opcoes: [
          { value: 'all', label: 'Todas as alunas' },
          { value: 'course', label: 'Alunas de um curso' },
          { value: 'cohort', label: 'Uma turma' },
          { value: 'user', label: 'Uma aluna' },
        ],
      },
      {
        nome: 'course_id',
        rotulo: 'Curso',
        tipo: 'reference',
        referencia: { tabela: 'courses', rotulo: 'name' },
      },
      { nome: 'link_url', rotulo: 'Link', tipo: 'text' },
      { nome: 'link_label', rotulo: 'Texto do link', tipo: 'text' },
      { nome: 'starts_at', rotulo: 'Começa em', tipo: 'datetime' },
      { nome: 'ends_at', rotulo: 'Termina em', tipo: 'datetime' },
      STATUS,
    ],
  },

  /* ---------------------------------------------------------------------- */
  depoimentos: {
    tabela: 'testimonials',
    titulo: 'Depoimentos',
    singular: 'Depoimento',
    colunaTitulo: 'author_name',
    ordem: 'position',
    aviso:
      'Só é possível publicar depoimento verificado e com autorização de uso registrada. Depoimento inventado é proibido — o banco recusa.',
    campos: [
      { nome: 'author_name', rotulo: 'Nome de quem escreveu', tipo: 'text', obrigatorio: true },
      { nome: 'author_role', rotulo: 'Ocupação', tipo: 'text' },
      { nome: 'author_city', rotulo: 'Cidade', tipo: 'text' },
      { nome: 'content', rotulo: 'Depoimento', tipo: 'textarea', obrigatorio: true },
      {
        nome: 'source',
        rotulo: 'De onde veio',
        tipo: 'select',
        obrigatorio: true,
        opcoes: [
          { value: 'whatsapp', label: 'WhatsApp' },
          { value: 'instagram', label: 'Instagram' },
          { value: 'form', label: 'Formulário' },
          { value: 'video', label: 'Vídeo' },
          { value: 'email', label: 'E-mail' },
          { value: 'in_person', label: 'Presencial' },
        ],
      },
      { nome: 'collected_at', rotulo: 'Data da coleta', tipo: 'date' },
      { nome: 'is_verified', rotulo: 'Verificado (origem conferida)', tipo: 'checkbox' },
      POSICAO,
      STATUS,
    ],
  },
}

export function pegarSpec(entidade: string): EntidadeSpec | null {
  return ENTIDADES[entidade] ?? null
}
