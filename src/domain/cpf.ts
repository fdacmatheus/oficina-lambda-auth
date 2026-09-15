/**
 * Validacao de CPF pelo algoritmo dos digitos verificadores.
 *
 * A regra e identica a usada pela aplicacao principal em
 * `src/shared/validators/cpf-cnpj.validator.ts`. A duplicacao e deliberada:
 * a function serverless precisa ser autocontida para manter o cold start baixo
 * e nao pode depender do pacote da aplicacao, que carrega o NestJS inteiro.
 */

export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

export function isCpfValido(cpf: string): boolean {
  const digitos = apenasDigitos(cpf);

  if (digitos.length !== 11) return false;

  // Sequencias repetidas passam no calculo dos digitos, mas nao sao CPFs reais.
  if (/^(\d)\1+$/.test(digitos)) return false;

  const calcularDigito = (parcial: string, fatorInicial: number): number => {
    let total = 0;
    let fator = fatorInicial;

    for (const caractere of parcial) {
      total += parseInt(caractere, 10) * fator;
      fator -= 1;
    }

    const resto = (total * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const primeiro = calcularDigito(digitos.slice(0, 9), 10);
  if (primeiro !== parseInt(digitos[9], 10)) return false;

  const segundo = calcularDigito(digitos.slice(0, 10), 11);
  return segundo === parseInt(digitos[10], 10);
}

export function formatarCpf(cpf: string): string {
  const d = apenasDigitos(cpf);
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Mascara usada em log: preserva os tres primeiros digitos e os dois ultimos. */
export function mascararCpf(cpf: string): string {
  const d = apenasDigitos(cpf);
  if (d.length !== 11) return '***';
  return `${d.slice(0, 3)}.***.**${d.slice(9)}`;
}
