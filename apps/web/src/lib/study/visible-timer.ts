/**
 * Tempo visível (F4-T04): soma só os trechos em que a página estava visível. Ocultar a aba, bloquear a
 * tela ou trocar de app pausa a conta; voltar retoma. Relógio injetável para teste.
 */
export class VisibleTimer {
  private total = 0;
  private since: number | null;
  constructor(
    private readonly now: () => number = () => performance.now(),
    visible = true,
  ) {
    this.since = visible ? now() : null;
  }
  setVisible(visible: boolean): void {
    if (visible && this.since === null) this.since = this.now();
    if (!visible && this.since !== null) {
      this.total += this.now() - this.since;
      this.since = null;
    }
  }
  ms(): number {
    return Math.round(
      this.total + (this.since !== null ? this.now() - this.since : 0),
    );
  }
}
