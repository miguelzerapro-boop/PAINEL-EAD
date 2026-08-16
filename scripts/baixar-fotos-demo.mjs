/**
 * Baixa fotos de DEMONSTRAÇÃO do universo manicure.
 *
 *   node scripts/baixar-fotos-demo.mjs
 *
 * PROCEDÊNCIA: Unsplash. A licença do Unsplash permite uso comercial e
 * modificação sem atribuição obrigatória — por isso serve como material
 * temporário. NÃO se usa imagem do Google Imagens: aquilo é resultado de
 * busca sobre acervo de terceiros, com direito autoral de cada autor.
 *
 * ESTAS FOTOS SÃO TEMPORÁRIAS. Existem para a responsável avaliar a
 * composição enquanto o ensaio próprio não acontece. Cada arquivo entra em
 * `public/fotos/demo/`, e o nome carrega o aviso. Quando a foto real for
 * enviada pelo painel, ela vence — o código não muda.
 *
 * Nenhuma destas imagens pode ser apresentada como a instrutora, como aluna
 * da escola ou como resultado de trabalho da escola.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const DESTINO = 'public/fotos/demo'
await mkdir(DESTINO, { recursive: true })

/**
 * Candidatas. O id é o do Unsplash; a descrição é o que se ESPERA da foto.
 * Depois de baixar, cada arquivo é conferido a olho antes de entrar no site —
 * id de banco de imagem não é garantia de assunto.
 */
const CANDIDATAS = [
  { arquivo: 'unhas-a', id: 'photo-1604654894610-df63bc536371', nota: 'mão com unhas esmaltadas' },
  { arquivo: 'unhas-b', id: 'photo-1610992015732-2449b76344bc', nota: 'manicure em atendimento' },
  { arquivo: 'unhas-c', id: 'photo-1519014816548-bf5fe059798b', nota: 'esmaltes / bancada' },
  { arquivo: 'unhas-d', id: 'photo-1632345031435-8727f6897d53', nota: 'detalhe de unha pronta' },
  { arquivo: 'unhas-e', id: 'photo-1522337360788-8b13dee7a37e', nota: 'esmaltes coloridos' },
  { arquivo: 'unhas-f', id: 'photo-1607779097040-26e80aa78e66', nota: 'mãos com esmaltação' },
  { arquivo: 'unhas-g', id: 'photo-1595475207225-428b62bda831', nota: 'unhas em close' },
  { arquivo: 'unhas-h', id: 'photo-1636018943945-a2b4b7b4d3f0', nota: 'ferramentas de manicure' },
]

const LARGURA = 1600

const resultados = []

for (const c of CANDIDATAS) {
  const url = `https://images.unsplash.com/${c.id}?w=${LARGURA}&q=80&fm=jpg&fit=max`
  try {
    const resposta = await fetch(url)
    if (!resposta.ok) {
      resultados.push({ ...c, ok: false, motivo: `HTTP ${resposta.status}` })
      continue
    }
    const tipo = resposta.headers.get('content-type') ?? ''
    if (!tipo.startsWith('image/')) {
      resultados.push({ ...c, ok: false, motivo: `tipo ${tipo}` })
      continue
    }
    const bytes = Buffer.from(await resposta.arrayBuffer())
    const destino = path.join(DESTINO, `${c.arquivo}.jpg`)
    await writeFile(destino, bytes)
    resultados.push({ ...c, ok: true, bytes: bytes.length, destino })
  } catch (e) {
    resultados.push({ ...c, ok: false, motivo: e.message })
  }
}

for (const r of resultados) {
  const tam = r.ok ? `${Math.round(r.bytes / 1024)} KB` : r.motivo
  console.log(`${r.ok ? 'ok  ' : 'FALHA'} ${r.arquivo.padEnd(10)} ${String(tam).padEnd(12)} ${r.nota}`)
}

const baixadas = resultados.filter((r) => r.ok).length
console.log(`\n${baixadas}/${CANDIDATAS.length} baixadas em ${DESTINO}/`)
console.log('CONFERIR A OLHO antes de usar: id de banco não garante o assunto.')
