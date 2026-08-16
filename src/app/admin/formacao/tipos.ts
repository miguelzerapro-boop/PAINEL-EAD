import type { EstadoEnvio } from '@/lib/video/estados'

/**
 * Tipos das ações da formação.
 *
 * Vivem fora de `acoes.ts` porque um arquivo `'use server'` só pode exportar
 * funções assíncronas — exportar um tipo de lá quebra o build.
 */

export type ResultadoPreparo =
  | {
      ok: true
      uploadId: string
      bucket: string
      /** `{course_id}/{lesson_id}/{uuid}.{ext}` — montado no servidor. */
      caminho: string
      /**
       * URL de retomada de um envio anterior desta mesma aula, quando houver.
       * Presente = continuar de onde parou; ausente = começar do zero.
       */
      urlDeRetomada: string | null
      /** Quantos bytes o servidor já tinha recebido, para a tela não zerar. */
      bytesEnviados: number
      estado: EstadoEnvio
      /** Já existia um envio em aberto e ele foi reaproveitado. */
      retomando: boolean
    }
  | { ok: false; message: string }

export type ResultadoEnvio =
  | { ok: true; caminho: string; jaEstava: boolean }
  | { ok: false; message: string }
