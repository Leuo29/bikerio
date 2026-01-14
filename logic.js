// config iniciais
const iconUsuario = L.icon({
  iconUrl: "loc.png",
  iconSize: [50, 50],
  iconAnchor: [25, 50],
  popupAnchor: [0, -50],
});

const iconBike = L.icon({
  iconUrl: "bikerio.png",
  iconSize: [35, 35],
  iconAnchor: [17, 35],
  popupAnchor: [0, -35],
});

let ultimaLocalizacao = [-22.9068, -43.1729];
// inicializa o mapa na praça xv

const map = L.map("map").setView([-22.9068, -43.1729], 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap",
}).addTo(map);

let marcadorBusca = L.marker([-22.9035, -43.1741], { icon: iconUsuario })
  .addTo(map)
  .bindPopup("Praça XV")
  .openPopup();

//consumo api d bicicleta citybik
async function buscarDadosBicicletarios() {
  try {
    const response = await fetch("https://api.citybik.es/bikerio.json");
    return await response.json();
  } catch (error) {
    console.error("Erro API Bike:", error);
    return [];
  }
}

// consumo da api LocationIQ para coordenadas do local (lat, long)
async function buscarCoordenadas(endereco) {
  const apiKey = "pk.342619f014082670367f394c117af0d7";

  try {
    const url = `https://us1.locationiq.com/v1/search?key=${apiKey}&q=${encodeURIComponent(
      endereco + ", Rio de Janeiro"
    )}&format=json`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Erro na requisição: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Erro ao buscar coordenadas no LocationIQ:", error);
    return null;
  }
}

// renderizaçao

function renderizarResultados(estacoes, marcadorPrincipal) {
  const listaDiv = document.getElementById("lista-bicicletarios");
  listaDiv.innerHTML = "";

  // limpa os icones anteriores
  map.eachLayer((layer) => {
    if (layer instanceof L.Marker && layer !== marcadorPrincipal) {
      map.removeLayer(layer);
    }
  });

  estacoes.forEach((estacao) => {
    const lat = estacao.lat;
    const lng = estacao.lng;

    // metros / 1000 = km
    const distanciaKm = (estacao.distanciaReal / 1000).toFixed(2);

    L.marker([lat, lng], { icon: iconBike }).addTo(map)
      .bindPopup(`<b>${estacao.name}</b><br>${distanciaKm} km de distância<br>Bikes disponíveis: ${estacao.bikes}<br>
        Vagas: ${estacao.free}`);

    const item = document.createElement("div");
    item.className = "card-bike mb-2 p-3 text-white";
    item.style.cssText =
      "border: 1px solid var(--itau-orange); border-radius: 10px; cursor: pointer; background: rgba(0,0,0,0.2);";
    item.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <span>
                  <span style="color: var(--itau-orange); font-weight: bold;">
                    ${estacao.name}
                  </span>
                  <br>
                  Bikes disponíveis: ${estacao.bikes} | Vagas: ${estacao.free}
                </span>
                <span class="badge km text-dark">${distanciaKm} km</span>
            </div>`;

    item.onclick = () => map.flyTo([lat, lng], 16);
    listaDiv.appendChild(item);
  });
}

document.getElementById("btn-recentralizar").addEventListener("click", () => {
  if (!ultimaLocalizacao) return;

  map.flyTo(ultimaLocalizacao, 15);
  marcadorBusca.openPopup();
});

//parte que roda tudo
document.querySelector("form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const textoBusca = document.querySelector(".barra-de-pesquisa").value.trim(); //remove espaços vazios no início/fim
  const qtdParaMostrar =
    parseInt(document.querySelector(".seletor").value) || 5;
  const listaDiv = document.getElementById("lista-bicicletarios");

  //se o campo estiver vazio emite um alerta
  if (textoBusca === "") {
    alert("Por favor, digite um endereço.");
    return;
  }

  // modifica a coluna do mapa e acrescenta a de results, colocando a pagina de carregando
  document.getElementById("coluna-lista").classList.remove("d-none");
  document
    .getElementById("coluna-mapa")
    .classList.replace("col-12", "col-md-7");
  map.invalidateSize();

  listaDiv.innerHTML = `
    <div class="d-flex justify-content-center mt-5">
      <div class="spinner-border" style="color: var(--itau-orange);" role="status"></div>
    </div>`;

  try {
    // 1 busca a loc digitada
    const resultadosGPS = await buscarCoordenadas(textoBusca);

    //se n houver results avisa
    if (!resultadosGPS || resultadosGPS.length === 0) {
      listaDiv.innerHTML = `
        <div class="alert alert-warning m-2">
          <strong>Endereço não encontrado!</strong><br>
          O endereço "${textoBusca}" não foi localizado no Rio. 
          Tente ser mais específico (ex: nome da rua).
        </div>`;
      return;
    }

    const localizacao = resultadosGPS[0];

    const partes = localizacao.display_name.split(", ");

    /**corta o resultado da loc pro popup, mostrando os:
     * 3 primeiros (normalmente: rua, bairro, cidade)
     * o 4º ultimo (normalmente: estado)
     * os 2 ultimos (normalmente: cep, pais) */

    const enderecoCurto = [
      ...partes.slice(0, 3),
      ...partes.slice(-4, -4),
      ...partes.slice(-2),
    ].join(", ");

    // seta o novo marcador
    const novasCoords = [localizacao.lat, localizacao.lon];

    ultimaLocalizacao = novasCoords;

    marcadorBusca
      .setLatLng(novasCoords)
      .setPopupContent(enderecoCurto)
      .openPopup();
    map.flyTo(novasCoords, 15);

    // 2 busca as estaçoes na api de bikes
    const estacoes = await buscarDadosBicicletarios();

    const pontoUsuario = L.latLng(localizacao.lat, localizacao.lon);

    const estacoesProcessadas = estacoes.map((estacao) => {
      //transforma a lat e long retornadas como int em um decimal
      const lat = estacao.lat / 1000000;
      const lng = estacao.lng / 1000000;
      const nomeTratado = estacao.name.split(" - ").slice(1).join(" - ");
      //calcula a distancia da coordenada da nominatim pra cada estaçao, usando a formula harversine para distancia (distanceTo)
      return {
        ...estacao,
        name: nomeTratado,
        lat,
        lng,
        distanciaReal: pontoUsuario.distanceTo(L.latLng(lat, lng)),
      };
    });

    // 3 ordena da menor dist para maior
    const maisProximas = estacoesProcessadas
      .sort((a, b) => a.distanciaReal - b.distanciaReal)
      .slice(0, qtdParaMostrar);

    // 4 renderiza o resultado
    renderizarResultados(maisProximas, marcadorBusca);
    document.querySelector("h1").innerText = "Busca concluída!";
  } catch (erro) {
    console.error(erro);
    listaDiv.innerHTML = `<div class="alert alert-danger">Ocorreu um erro na conexão.</div>`;
  }
});
