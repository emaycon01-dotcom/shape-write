/**
 * Sinal global de "documento sendo gerado agora".
 *
 * A geração é o momento de maior consumo de memória e rede do sistema. As
 * filas de sincronização (RG/CHA/CNH) rodavam em paralelo justamente nesse
 * instante, disputando memória com o motor de PDF — em celulares isso era
 * suficiente para a aba recarregar. Enquanto este sinal estiver ligado, as
 * filas simplesmente adiam o envio; nada é perdido, só atrasa alguns segundos.
 */
let busy = false;

export function setGenerationBusy(value: boolean) {
  busy = value;
}

export function isGenerationBusy(): boolean {
  return busy;
}
