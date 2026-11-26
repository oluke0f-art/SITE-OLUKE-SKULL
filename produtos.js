/* =========================================
   1. CONFIGURAÇÃO E ESTADO
   ========================================= */
const URL_PLANILHA = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSrdRuWilbz9leeNkHBz-5yi3jtELK25HqvG1QU4T_VgpniPlNkRUUY-EtqjQy9mKOacY1irm6gUuqM/pub?gid=0&single=true&output=csv";
const TAMANHO_CHUNK = 8;

let todosProdutosAtivos = [];
let listaAtual = [];
let indiceAtual = 0;
let modoTodos = false;
let observadorChunk = null;

/* =========================================
   2. PARSER CSV E LOGOS DAS LOJAS
   ========================================= */
function dividirLinhaCSV(linha) {
    const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
    return linha.split(regex).map(col => col.replace(/^"|"$/g, "").trim());
}

function obterLogoLoja(url) {
    const link = (url || "").toLowerCase();

    if (link.includes("shopee")) {
        return "https://play-lh.googleusercontent.com/mTrkXtOc1qiuA5oaivGHzGYuNkBVHRFam60DTOIjjKf7w_oA3ug4THxGMsbIHcQ7CinrrKHHOfsvQK3QDfBj_YM=s0-br30";
    }
    if (link.includes("amazon") || link.includes("amzn")) {
        return "https://play-lh.googleusercontent.com/UIYZ9hTFNg-zZUg_uzLS9YdyDpvoo1VHNFb6VlzHy5JqNMq9Uq-p2S1VPwzXCipHTFacfGKhJkyAuKL19VVlcWA=w240-h480-rw";
    }
    if (link.includes("mercadolivre") || link.includes("meli")) {
        return "https://play-lh.googleusercontent.com/iVaeA0HDw8CZjEM-K7GdLB9XYmpcwVFSuv4Q8o9uh4Br7PuKCm3QSYCVU73tr9BBXdR_7xTX4yO0azOJegRVcA";
    }
    if (link.includes("aliexpress")) {
        return "https://play-lh.googleusercontent.com/-26EaFSeFE-GPfgjA98H_ukuK2AEN0ZlMNB9lECGJDxUSG7G20emcnXaHrM5fL2d7mCi3O825iShQvn2J0ZY";
    }

    try {
        const dominio = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${dominio}&sz=64`;
    } catch {
        return "assets/icon-pack/shopping-bag.svg";
    }
}

/* =========================================
   3. RENDERIZAÇÃO E CARREGAMENTO EM CHUNKS
   ========================================= */
function criarCardProduto(produto) {
    const logoLoja = obterLogoLoja(produto.link);
    const card = document.createElement("a");

    card.className = "cardProduto";
    card.href = produto.link;
    card.target = "_blank";
    card.rel = "noopener noreferrer";

    card.innerHTML = `
        <img class="logoLoja" src="${logoLoja}" alt="Logo da loja">
        <img class="fotoProduto" src="${produto.imagem}" alt="${produto.nome}" loading="lazy">
        <h3 class="nomeProduto">${produto.nome}</h3>
        <p class="verOferta">Ver oferta ↗</p>
    `;

    return card;
}

function carregarProximoChunk() {
    const grade = document.getElementById("gradeProdutos");
    if (!grade || indiceAtual >= listaAtual.length) return;

    const proximoLimite = Math.min(indiceAtual + TAMANHO_CHUNK, listaAtual.length);
    const fragmento = document.createDocumentFragment();

    for (let i = indiceAtual; i < proximoLimite; i++) {
        fragmento.appendChild(criarCardProduto(listaAtual[i]));
    }

    grade.appendChild(fragmento);
    indiceAtual = proximoLimite;

    if (indiceAtual >= listaAtual.length && observadorChunk) {
        observadorChunk.disconnect();
    }
}

function configurarSensorChunk() {
    const sensor = document.getElementById("sensorChunk");
    if (!sensor) return;

    if (observadorChunk) {
        observadorChunk.disconnect();
    }

    observadorChunk = new IntersectionObserver(
        (entradas) => {
            if (entradas[0].isIntersecting) {
                carregarProximoChunk();
            }
        },
        {
            root: null,
            rootMargin: "250px",
            threshold: 0.01
        }
    );

    observadorChunk.observe(sensor);
}

function renderizarModo(mostrarTodos) {
    const grade = document.getElementById("gradeProdutos");
    const titulo = document.getElementById("tituloLoja");
    const btnTexto = document.querySelector("#btnTodosProdutos span");

    if (!grade) return;

    modoTodos = mostrarTodos;
    grade.innerHTML = "";
    indiceAtual = 0;

    if (modoTodos) {
        listaAtual = todosProdutosAtivos;
        if (titulo) titulo.textContent = "Todos os Produtos";
        if (btnTexto) btnTexto.textContent = "Ver Destaques";
    } else {
        listaAtual = todosProdutosAtivos.filter(p => p.destaque);
        if (titulo) titulo.textContent = "Destaques dos Achadinhos";
        if (btnTexto) btnTexto.textContent = "Todos os Produtos";
    }

    if (listaAtual.length === 0) {
        grade.innerHTML = "<p>Nenhum produto encontrado nesta seção.</p>";
        return;
    }

    carregarProximoChunk();
    configurarSensorChunk();
}

/* =========================================
   4. INICIALIZAÇÃO
   ========================================= */
async function iniciarLoja() {
    const grade = document.getElementById("gradeProdutos");
    const btnTodos = document.getElementById("btnTodosProdutos");

    if (!grade) return;

    try {
        const resposta = await fetch(URL_PLANILHA);
        const texto = await resposta.text();
        const linhas = texto.split(/\r?\n/).slice(1);

        todosProdutosAtivos = linhas
            .map(linha => {
                const colunas = dividirLinhaCSV(linha);
                return {
                    ativo: colunas[0]?.toUpperCase() === "TRUE",
                    destaque: colunas[1]?.toUpperCase() === "TRUE",
                    link: colunas[2] || "#",
                    nome: colunas[3] || "",
                    imagem: colunas[4] || "assets/Galaxia.jpg",
                    categoria: colunas[5] || ""
                };
            })
            .filter(produto => produto.ativo && produto.nome);

        renderizarModo(false);

        if (btnTodos) {
            btnTodos.addEventListener("click", (e) => {
                e.preventDefault();
                renderizarModo(!modoTodos);
            });
        }
    } catch (erro) {
        console.error("Erro ao carregar a planilha:", erro);
        grade.innerHTML = "<p>Não foi possível carregar os produtos no momento.</p>";
    }
}

iniciarLoja();