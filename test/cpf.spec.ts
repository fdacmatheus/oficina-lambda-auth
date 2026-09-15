import { isCpfValido, apenasDigitos, mascararCpf, formatarCpf } from '../src/domain/cpf';

describe('validacao de CPF', () => {
  it.each(['529.982.247-25', '52998224725', '111.444.777-35'])(
    'aceita o CPF valido %s',
    (cpf) => {
      expect(isCpfValido(cpf)).toBe(true);
    },
  );

  it.each(['529.982.247-26', '12345678900', '111.111.111-11', '00000000000'])(
    'recusa o CPF invalido %s',
    (cpf) => {
      expect(isCpfValido(cpf)).toBe(false);
    },
  );

  it('recusa documento com quantidade de digitos diferente de 11', () => {
    expect(isCpfValido('5299822472')).toBe(false);
    expect(isCpfValido('529982247250')).toBe(false);
    expect(isCpfValido('')).toBe(false);
  });

  it('recusa CNPJ, que tem 14 digitos', () => {
    expect(isCpfValido('11.222.333/0001-81')).toBe(false);
  });

  it('normaliza a pontuacao antes de validar', () => {
    expect(apenasDigitos('529.982.247-25')).toBe('52998224725');
  });

  it('formata o CPF com a pontuacao padrao', () => {
    expect(formatarCpf('52998224725')).toBe('529.982.247-25');
  });

  it('mascara o CPF preservando apenas as pontas', () => {
    expect(mascararCpf('52998224725')).toBe('529.***.**25');
  });

  it('mascara integralmente um documento malformado', () => {
    expect(mascararCpf('123')).toBe('***');
  });
});
