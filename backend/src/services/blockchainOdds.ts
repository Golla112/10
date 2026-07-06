// Blockchain Odds System - Quote trasparenti e immutabili su blockchain
// Smart contracts per quote verificabili e decentralizzate

import Web3 from 'web3';
import { ProSportsEvent, ProSportsOdds } from './proSportsApiService';

// ── Smart Contract ABI ───────────────────────────────────────────────────────────────

const ODDS_CONTRACT_ABI = [
  {
    "inputs": [
      {"internalType": "string", "name": "eventId", "type": "string"},
      {"internalType": "uint256", "name": "homeOdds", "type": "uint256"},
      {"internalType": "uint256", "name": "drawOdds", "type": "uint256"},
      {"internalType": "uint256", "name": "awayOdds", "type": "uint256"},
      {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
      {"internalType": "string", "name": "signature", "type": "string"}
    ],
    "name": "publishOdds",
    "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "string", "name": "eventId", "type": "string"}],
    "name": "getOddsHistory",
    "outputs": [
      {
        "components": [
          {"internalType": "uint256", "name": "homeOdds", "type": "uint256"},
          {"internalType": "uint256", "name": "drawOdds", "type": "uint256"},
          {"internalType": "uint256", "name": "awayOdds", "type": "uint256"},
          {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
          {"internalType": "string", "name": "signature", "type": "string"}
        ],
        "internalType": "struct OddsContract.OddsData[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "string", "name": "eventId", "type": "string"},
      {"internalType": "uint256", "name": "result", "type": "uint256"}
    ],
    "name": "settleEvent",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// ── Blockchain Configuration ───────────────────────────────────────────────────────

interface BlockchainConfig {
  provider: string;
  contractAddress: string;
  privateKey: string;
  gasLimit: number;
  gasPrice: string;
}

class BlockchainOddsSystem {
  private web3!: Web3;
  private contract: any;
  private config: BlockchainConfig;
  private isInitialized = false;

  constructor() {
    this.config = {
      provider: process.env.BLOCKCHAIN_PROVIDER || 'http://localhost:8545',
      contractAddress: process.env.ODDS_CONTRACT_ADDRESS || '0x1234567890123456789012345678901234567890',
      privateKey: process.env.PRIVATE_KEY || '0x1234567890123456789012345678901234567890123456789012345678901234',
      gasLimit: 200000,
      gasPrice: '20000000000' // 20 Gwei
    };

    this.initializeBlockchain();
  }

  /**
   * Inizializza connessione blockchain
   */
  private async initializeBlockchain() {
    try {
      this.web3 = new Web3(this.config.provider);
      
      // Verifica connessione
      const networkId = await this.web3.eth.net.getId();
      console.log(`Connesso alla blockchain network ID: ${networkId}`);
      
      // Inizializza contratto
      this.contract = new this.web3.eth.Contract(ODDS_CONTRACT_ABI, this.config.contractAddress);
      
      // Crea wallet account
      const account = this.web3.eth.accounts.privateKeyToAccount(this.config.privateKey);
      this.web3.eth.accounts.wallet.add(account);
      
      this.isInitialized = true;
      console.log('Blockchain odds system inizializzato');
      
    } catch (error) {
      console.error('Errore inizializzazione blockchain:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Pubblica quote su blockchain (immutabili e verificabili)
   */
  async publishOddsToBlockchain(
    eventId: string, 
    odds: { home: number; draw: number; away: number }
  ): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Blockchain non inizializzata');
    }

    try {
      // Converti quote in interi (2 decimal places)
      const homeOdds = Math.round(odds.home * 100);
      const drawOdds = Math.round(odds.draw * 100);
      const awayOdds = Math.round(odds.away * 100);
      const timestamp = Math.floor(Date.now() / 1000);

      // Crea firma digitale per verifica
      const message = `${eventId}${homeOdds}${drawOdds}${awayOdds}${timestamp}`;
      const signature = await this.signMessage(message);

      // Prepara transazione
      const tx = {
        from: this.web3.eth.accounts.wallet[0].address,
        to: this.config.contractAddress,
        gas: this.config.gasLimit,
        gasPrice: this.config.gasPrice,
        data: this.contract.methods.publishOdds(
          eventId,
          homeOdds,
          drawOdds,
          awayOdds,
          timestamp,
          signature
        ).encodeABI()
      };

      // Invia transazione
      const txHash = await this.web3.eth.sendTransaction(tx);
      console.log(`Quote pubblicate su blockchain: ${txHash.transactionHash}`);

      // Attendi conferma
      const receipt = await this.web3.eth.getTransactionReceipt(txHash.transactionHash);
      
      if (receipt.status) {
        console.log('Transazione confermata sulla blockchain');
        return String(txHash.transactionHash);
      } else {
        throw new Error('Transazione fallita');
      }

    } catch (error) {
      console.error('Errore pubblicazione quote blockchain:', error);
      throw error;
    }
  }

  /**
   * Firma digitale per verifica integrità quote
   */
  private async signMessage(message: string): Promise<string> {
    const signature = await this.web3.eth.sign(message, this.web3.eth.accounts.wallet[0].address);
    return String(signature);
  }

  /**
   * Recupera storico quote da blockchain
   */
  async getOddsHistory(eventId: string): Promise<any[]> {
    if (!this.isInitialized) {
      throw new Error('Blockchain non inizializzata');
    }

    try {
      const history = await this.contract.methods.getOddsHistory(eventId).call();
      
      // Converti dati blockchain in formato leggibile
      return history.map((item: any) => ({
        homeOdds: item.homeOdds / 100,
        drawOdds: item.drawOdds / 100,
        awayOdds: item.awayOdds / 100,
        timestamp: new Date(item.timestamp * 1000),
        signature: item.signature,
        verified: this.verifySignature(item)
      }));

    } catch (error) {
      console.error('Errore recupero storico quote:', error);
      return [];
    }
  }

  /**
   * Verifica firma digitale quote
   */
  private verifySignature(oddsData: any): boolean {
    try {
      const message = `${oddsData.eventId}${oddsData.homeOdds}${oddsData.drawOdds}${oddsData.awayOdds}${oddsData.timestamp}`;
      const recoveredAddress = this.web3.eth.accounts.recover(message, oddsData.signature);
      
      return recoveredAddress.toLowerCase() === this.web3.eth.accounts.wallet[0].address.toLowerCase();
    } catch (error) {
      return false;
    }
  }

  /**
   * Settle evento su blockchain
   */
  async settleEventOnBlockchain(eventId: string, result: 'home' | 'draw' | 'away'): Promise<boolean> {
    if (!this.isInitialized) {
      throw new Error('Blockchain non inizializzata');
    }

    try {
      const resultValue = result === 'home' ? 1 : result === 'draw' ? 2 : 3;
      
      const tx = {
        from: this.web3.eth.accounts.wallet[0].address,
        to: this.config.contractAddress,
        gas: this.config.gasLimit,
        gasPrice: this.config.gasPrice,
        data: this.contract.methods.settleEvent(eventId, resultValue).encodeABI()
      };

      const txHash = await this.web3.eth.sendTransaction(tx);
      const receipt = await this.web3.eth.getTransactionReceipt(txHash.transactionHash);
      
      const status = receipt.status as unknown;
      if (typeof status === 'bigint') return status !== 0n;
      return Boolean(status);

    } catch (error) {
      console.error('Errore settlement evento:', error);
      return false;
    }
  }

  /**
   * Verifica integrità quote blockchain vs attuali
   */
  async verifyOddsIntegrity(eventId: string, currentOdds: ProSportsOdds): Promise<boolean> {
    try {
      const blockchainHistory = await this.getOddsHistory(eventId);
      
      if (blockchainHistory.length === 0) {
        return true; // Nessuna storico, OK
      }

      // Confronta ultima quote blockchain con attuali
      const latestBlockchainOdds = blockchainHistory[blockchainHistory.length - 1];
      const currentH2HOdds = currentOdds.markets.find(m => m.marketId === 'h2h');
      
      if (!currentH2HOdds) return false;

      const tolerance = 0.05; // 5% tolleranza
      
      const homeDiff = Math.abs(latestBlockchainOdds.homeOdds - currentH2HOdds.outcomes[0]?.price || 0) / latestBlockchainOdds.homeOdds;
      const drawDiff = Math.abs(latestBlockchainOdds.drawOdds - currentH2HOdds.outcomes[1]?.price || 0) / latestBlockchainOdds.drawOdds;
      const awayDiff = Math.abs(latestBlockchainOdds.awayOdds - currentH2HOdds.outcomes[2]?.price || 0) / latestBlockchainOdds.awayOdds;

      return homeDiff <= tolerance && drawDiff <= tolerance && awayDiff <= tolerance;

    } catch (error) {
      console.error('Errore verifica integrità quote:', error);
      return false;
    }
  }

  /**
   * Crea oracle per dati esterni
   */
  async createOddsOracle(eventId: string, dataSource: string): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Blockchain non inizializzata');
    }

    try {
      // Simulazione creazione oracle per dati esterni
      const oracleData = {
        eventId,
        dataSource,
        timestamp: Date.now(),
        signature: await this.signMessage(`${eventId}${dataSource}${Date.now()}`)
      };

      // In una reale implementazione, questo creerebbe un nuovo contratto oracle
      console.log('Oracle creato per dati esterni:', oracleData);
      
      return `oracle_${eventId}_${Date.now()}`;

    } catch (error) {
      console.error('Errore creazione oracle:', error);
      throw error;
    }
  }

  /**
   * Monitora transazioni in tempo reale
   */
  startTransactionMonitoring(): void {
    if (!this.isInitialized) return;

    this.web3.eth.subscribe('newBlockHeaders', (error: any, blockHeader: any) => {
      if (error) {
        console.error('Errore monitoring blockchain:', error);
        return;
      }

      console.log(`Nuovo blocco: ${blockHeader.number} - Hash: ${blockHeader.hash}`);
      
      // Qui potresti verificare transazioni rilevanti per le quote
    });
  }

  /**
   * Get blockchain statistics
   */
  async getBlockchainStats(): Promise<any> {
    if (!this.isInitialized) {
      return { connected: false };
    }

    try {
      const latestBlock = await this.web3.eth.getBlockNumber();
      const gasPrice = await this.web3.eth.getGasPrice();
      const balance = await this.web3.eth.getBalance(this.web3.eth.accounts.wallet[0].address);

      return {
        connected: true,
        latestBlock,
        gasPrice: this.web3.utils.fromWei(gasPrice, 'gwei'),
        balance: this.web3.utils.fromWei(balance, 'ether'),
        contractAddress: this.config.contractAddress
      };

    } catch (error: unknown) {
      return { connected: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Check system health
   */
  async healthCheck(): Promise<{ status: string; details: any }> {
    const stats = await this.getBlockchainStats();
    const isHealthy = stats.connected && stats.latestBlock > 0;

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      details: {
        blockchain: stats,
        contract: this.config.contractAddress,
        initialized: this.isInitialized
      }
    };
  }
}

// ── Esportazione ───────────────────────────────────────────────────────────────────

export const blockchainOddsSystem = new BlockchainOddsSystem();

export default blockchainOddsSystem;
