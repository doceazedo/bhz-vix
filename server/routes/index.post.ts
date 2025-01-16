type ValeResponse = {
  excessao: any;
  descricaoOrigem: string;
  descricaoDestino: string;
  dataViagemPrevista: number;
  dataViagemProgramada: number;
  dataViagemVoltaPrevista: number;
  dataViagemVoltaProgramada: number;
  quantidadePassageiros: number;
  passagensIda: Array<{
    tipo: string;
    tokenCompra: string;
    idOrigem: number;
    idDestino: number;
    descricaoPrefixoTrem: string;
    descricaoTrem: string;
    descricaoOrigem: string;
    descricaoJuncao: any;
    descricaoDestino: string;
    partidaProgramada: number;
    chegadaProgramada: number;
    horaPartidaPrevista: string;
    horaPartidaProgramada: string;
    partidaPrevista: number;
    chegadaPrevista: number;
    horaChegadaPrevista: string;
    horaChegadaProgramada: string;
    descricaoClasse: string;
    indicadorClasseCadeirante: string;
    idClasse: number;
    qtdTotal: number;
    valorTotal: number;
    descricaoSubTrechos: Array<any>;
  }>;
  passagensVolta: Array<{
    tipo: string;
    tokenCompra: string;
    idOrigem: number;
    idDestino: number;
    descricaoPrefixoTrem: string;
    descricaoTrem: string;
    descricaoOrigem: string;
    descricaoJuncao: any;
    descricaoDestino: string;
    partidaProgramada: number;
    chegadaProgramada: number;
    horaPartidaPrevista: string;
    horaPartidaProgramada: string;
    partidaPrevista: number;
    chegadaPrevista: number;
    horaChegadaPrevista: string;
    horaChegadaProgramada: string;
    descricaoClasse: string;
    indicadorClasseCadeirante: string;
    idClasse: number;
    qtdTotal: number;
    valorTotal: number;
    descricaoSubTrechos: Array<any>;
  }>;
  buscarPorSubTrecho: any;
};

const DEPART_DATE = new Date("2025-02-28 GMT-3");
const RETURN_DATE = new Date("2025-03-05 GMT-3");

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("pt-BR").format(date);

const formatJourney = (journey: any) => {
  if (!journey) return "*Não encontrado*";
  const date = formatDate(new Date(journey?.partidaProgramada || 0));
  const price = `R$ ${((journey?.valorTotal as number) || 0)
    .toFixed(2)
    .replace(".", ",")}`;
  return `${date} 💸 **Preço:** ${price} 💼 **Classe:** ${
    journey?.descricaoClasse || "-"
  }`;
};

const sendAlert = async (content: string) => {
  try {
    fetch(`${process.env.DISCORD_WEBHOOK_URL}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content,
        allowed_mentions: {
          parse: ["roles"],
        },
      }),
    });
  } catch (error) {}
};

const fetchJourney = async (date: Date) => {
  try {
    const resp = await fetch(
      "https://tremdepassageiros.vale.com/sgpweb/rest/externo/VendaInternet/publico/pesquisaPassagem",
      {
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          codigoFerrovia: "03",
          codigoLocalOrigem: 7185,
          codigoLocalDestino: 7172,
          detalheVenda: [{ detalhe: 33, qtd: 1, funcionario: false }],
          dataIda: date.getTime(),
          codigoClasse: 44,
        }),
        method: "POST",
      }
    );
    if (!resp.ok) {
      await sendAlert(
        [
          "😵‍💫 Bad response!",
          "```",
          JSON.stringify(Object.fromEntries(resp.headers), null, 2),
          "```",
          "```",
          await resp.text(),
          "```",
        ].join("\n")
      );
      return null;
    }
    const data = await resp.json();
    return data as ValeResponse;
  } catch (error) {
    await sendAlert(["😵‍💫 Fetch error!", "```", error, "```"].join("\n"));
    return null;
  }
};

const fetchJourneys = async () => {
  const [departData, returnData] = await Promise.all([
    fetchJourney(DEPART_DATE),
    fetchJourney(RETURN_DATE),
  ]);
  if (!departData || !returnData) return null;
  return {
    depart: departData.passagensIda?.[0],
    return: returnData.passagensIda?.[0],
  };
};

export default eventHandler(async (event) => {
  const authToken = event.headers.get("Authorization");
  if (authToken !== `Bearer ${process.env.AUTH_TOKEN}`) {
    return new Response(undefined, { status: 401 });
  }

  const data = await fetchJourneys();
  if (!data) return new Response(undefined, { status: 500 });

  if (!data.depart && !data.return) {
    const departDate = formatDate(DEPART_DATE);
    const returnDate = formatDate(RETURN_DATE);
    await sendAlert(
      `Nenhuma passagem disponível para ${departDate} - ${returnDate} ainda 😔`
    );
    return new Response(undefined, { status: 200 });
  }

  const departJourney = formatJourney(data.depart);
  const returnJourney = formatJourney(data.return);

  await sendAlert(
    [
      "**Encontrei passagens!** 🚂💕",
      `**↗️ Ida:** ${departJourney}`,
      `**↙️ Volta:** ${returnJourney}`,
      `<@&1303500039582126153>`,
    ].join("\n")
  );
  return new Response(undefined, { status: 204 });
});
