import { describe, it, expect, beforeEach } from "vitest";
import { stringUtf8CV, uintCV, buffCV, principalCV, listCV, boolCV } from "@stacks/transactions";

const ERR_DUPLICATE_HASH = 100;
const ERR_NOT_AUTHORIZED = 101;
const ERR_INVALID_HASH = 102;
const ERR_INVALID_TITLE = 103;
const ERR_INVALID_DESCRIPTION = 104;
const ERR_INVALID_CATEGORY = 105;
const ERR_PATENT_NOT_FOUND = 106;
const ERR_INVALID_TIMESTAMP = 107;
const ERR_AUTHORITY_NOT_VERIFIED = 108;
const ERR_INVALID_STATUS = 109;
const ERR_INVALID_OWNER = 110;
const ERR_TRANSFER_NOT_ALLOWED = 111;
const ERR_INVALID_UPDATE_PARAM = 112;
const ERR_MAX_PATENTS_EXCEEDED = 113;
const ERR_INVALID_FEE = 114;
const ERR_INVALID_LICENSE_TERM = 115;
const ERR_INVALID_ROYALTY_RATE = 116;
const ERR_INVALID_LOCATION = 117;
const ERR_INVALID_CURRENCY = 118;
const ERR_PATENT_EXPIRED = 119;
const ERR_INVALID_EXPIRATION = 120;

interface Patent {
  hash: Uint8Array;
  owner: string;
  title: string;
  description: string;
  category: string;
  timestamp: number;
  creator: string;
  status: boolean;
  expiration: number;
  licenseTerm: number;
  royaltyRate: number;
  location: string;
  currency: string;
}

interface PatentUpdate {
  updateTitle: string;
  updateDescription: string;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class PatentRegistryMock {
  state: {
    nextPatentId: number;
    maxPatents: number;
    registrationFee: number;
    authorityContract: string | null;
    patents: Map<number, Patent>;
    patentUpdates: Map<number, PatentUpdate>;
    patentsByHash: Map<string, number>;
    patentsByOwner: Map<string, number[]>;
  } = {
    nextPatentId: 0,
    maxPatents: 10000,
    registrationFee: 500,
    authorityContract: null,
    patents: new Map(),
    patentUpdates: new Map(),
    patentsByHash: new Map(),
    patentsByOwner: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  authorities: Set<string> = new Set(["ST1TEST"]);
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextPatentId: 0,
      maxPatents: 10000,
      registrationFee: 500,
      authorityContract: null,
      patents: new Map(),
      patentUpdates: new Map(),
      patentsByHash: new Map(),
      patentsByOwner: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.authorities = new Set(["ST1TEST"]);
    this.stxTransfers = [];
  }

  isVerifiedAuthority(principal: string): Result<boolean> {
    return { ok: true, value: this.authorities.has(principal) };
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setRegistrationFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    if (newFee < 0) return { ok: false, value: false };
    this.state.registrationFee = newFee;
    return { ok: true, value: true };
  }

  setMaxPatents(newMax: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    if (newMax <= 0) return { ok: false, value: false };
    this.state.maxPatents = newMax;
    return { ok: true, value: true };
  }

  registerPatent(
    hash: Uint8Array,
    title: string,
    description: string,
    category: string,
    expiration: number,
    licenseTerm: number,
    royaltyRate: number,
    location: string,
    currency: string
  ): Result<number> {
    if (this.state.nextPatentId >= this.state.maxPatents) return { ok: false, value: ERR_MAX_PATENTS_EXCEEDED };
    if (hash.length !== 32) return { ok: false, value: ERR_INVALID_HASH };
    if (!title || title.length > 100) return { ok: false, value: ERR_INVALID_TITLE };
    if (!description || description.length > 500) return { ok: false, value: ERR_INVALID_DESCRIPTION };
    if (!["pharma", "biotech", "medical"].includes(category)) return { ok: false, value: ERR_INVALID_CATEGORY };
    if (expiration <= this.blockHeight) return { ok: false, value: ERR_INVALID_EXPIRATION };
    if (licenseTerm <= 0) return { ok: false, value: ERR_INVALID_LICENSE_TERM };
    if (royaltyRate > 50) return { ok: false, value: ERR_INVALID_ROYALTY_RATE };
    if (!location || location.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (!["STX", "USD", "BTC"].includes(currency)) return { ok: false, value: ERR_INVALID_CURRENCY };
    if (!this.isVerifiedAuthority(this.caller).value) return { ok: false, value: ERR_NOT_AUTHORIZED };
    const hashStr = hash.toString();
    if (this.state.patentsByHash.has(hashStr)) return { ok: false, value: ERR_DUPLICATE_HASH };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.registrationFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.nextPatentId;
    const patent: Patent = {
      hash,
      owner: this.caller,
      title,
      description,
      category,
      timestamp: this.blockHeight,
      creator: this.caller,
      status: true,
      expiration,
      licenseTerm,
      royaltyRate,
      location,
      currency,
    };
    this.state.patents.set(id, patent);
    this.state.patentsByHash.set(hashStr, id);
    const ownerList = this.state.patentsByOwner.get(this.caller) || [];
    ownerList.push(id);
    if (ownerList.length > 100) ownerList.shift();
    this.state.patentsByOwner.set(this.caller, ownerList);
    this.state.nextPatentId++;
    return { ok: true, value: id };
  }

  getPatent(id: number): Patent | null {
    return this.state.patents.get(id) || null;
  }

  updatePatent(id: number, updateTitle: string, updateDescription: string): Result<boolean> {
    const patent = this.state.patents.get(id);
    if (!patent) return { ok: false, value: false };
    if (patent.owner !== this.caller) return { ok: false, value: false };
    if (!updateTitle || updateTitle.length > 100) return { ok: false, value: false };
    if (!updateDescription || updateDescription.length > 500) return { ok: false, value: false };

    const updated: Patent = {
      ...patent,
      title: updateTitle,
      description: updateDescription,
      timestamp: this.blockHeight,
    };
    this.state.patents.set(id, updated);
    this.state.patentUpdates.set(id, {
      updateTitle,
      updateDescription,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  transferPatentOwnership(id: number, newOwner: string): Result<boolean> {
    const patent = this.state.patents.get(id);
    if (!patent) return { ok: false, value: false };
    if (patent.owner !== this.caller) return { ok: false, value: false };
    if (newOwner === "SP000000000000000000002Q6VF78") return { ok: false, value: false };
    if (!patent.status) return { ok: false, value: false };
    if (this.blockHeight >= patent.expiration) return { ok: false, value: false };

    const updated: Patent = {
      ...patent,
      owner: newOwner,
      timestamp: this.blockHeight,
    };
    this.state.patents.set(id, updated);

    const oldOwnerList = this.state.patentsByOwner.get(this.caller) || [];
    this.state.patentsByOwner.set(this.caller, oldOwnerList.filter((patId) => patId !== id));

    const newOwnerList = this.state.patentsByOwner.get(newOwner) || [];
    newOwnerList.push(id);
    if (newOwnerList.length > 100) newOwnerList.shift();
    this.state.patentsByOwner.set(newOwner, newOwnerList);

    return { ok: true, value: true };
  }

  verifyPatentOwnership(id: number, claimedOwner: string): Result<boolean> {
    const patent = this.state.patents.get(id);
    if (!patent) return { ok: false, value: false };
    return { ok: true, value: patent.owner === claimedOwner };
  }

  getPatentCount(): Result<number> {
    return { ok: true, value: this.state.nextPatentId };
  }

  checkPatentExistence(hash: Uint8Array): Result<boolean> {
    return { ok: true, value: this.state.patentsByHash.has(hash.toString()) };
  }

  getPatentsByOwner(owner: string): number[] {
    return this.state.patentsByOwner.get(owner) || [];
  }
}

describe("PatentRegistry", () => {
  let contract: PatentRegistryMock;

  beforeEach(() => {
    contract = new PatentRegistryMock();
    contract.reset();
  });

  it("registers a patent successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(1);
    const result = contract.registerPatent(
      hash,
      "Test Title",
      "Test Description",
      "pharma",
      100,
      10,
      5,
      "LocationX",
      "STX"
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const patent = contract.getPatent(0);
    expect(patent?.hash).toEqual(hash);
    expect(patent?.title).toBe("Test Title");
    expect(patent?.description).toBe("Test Description");
    expect(patent?.category).toBe("pharma");
    expect(patent?.expiration).toBe(100);
    expect(patent?.licenseTerm).toBe(10);
    expect(patent?.royaltyRate).toBe(5);
    expect(patent?.location).toBe("LocationX");
    expect(patent?.currency).toBe("STX");
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate patent hashes", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(1);
    contract.registerPatent(
      hash,
      "Test Title",
      "Test Description",
      "pharma",
      100,
      10,
      5,
      "LocationX",
      "STX"
    );
    const result = contract.registerPatent(
      hash,
      "Another Title",
      "Another Description",
      "biotech",
      200,
      20,
      10,
      "LocationY",
      "USD"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_DUPLICATE_HASH);
  });

  it("rejects non-authorized caller", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.caller = "ST2FAKE";
    contract.authorities = new Set();
    const hash = new Uint8Array(32).fill(2);
    const result = contract.registerPatent(
      hash,
      "Test Title",
      "Test Description",
      "pharma",
      100,
      10,
      5,
      "LocationX",
      "STX"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects registration without authority contract", () => {
    const hash = new Uint8Array(32).fill(3);
    const result = contract.registerPatent(
      hash,
      "NoAuth Title",
      "NoAuth Description",
      "pharma",
      100,
      10,
      5,
      "LocationX",
      "STX"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects invalid hash length", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(31).fill(4);
    const result = contract.registerPatent(
      hash,
      "Invalid Hash",
      "Test Description",
      "pharma",
      100,
      10,
      5,
      "LocationX",
      "STX"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_HASH);
  });

  it("rejects invalid title", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(5);
    const result = contract.registerPatent(
      hash,
      "",
      "Test Description",
      "pharma",
      100,
      10,
      5,
      "LocationX",
      "STX"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_TITLE);
  });

  it("rejects invalid category", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(6);
    const result = contract.registerPatent(
      hash,
      "Test Title",
      "Test Description",
      "invalid",
      100,
      10,
      5,
      "LocationX",
      "STX"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_CATEGORY);
  });

  it("updates a patent successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(7);
    contract.registerPatent(
      hash,
      "Old Title",
      "Old Description",
      "pharma",
      100,
      10,
      5,
      "LocationX",
      "STX"
    );
    const result = contract.updatePatent(0, "New Title", "New Description");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const patent = contract.getPatent(0);
    expect(patent?.title).toBe("New Title");
    expect(patent?.description).toBe("New Description");
    const update = contract.state.patentUpdates.get(0);
    expect(update?.updateTitle).toBe("New Title");
    expect(update?.updateDescription).toBe("New Description");
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update for non-existent patent", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.updatePatent(99, "New Title", "New Description");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects update by non-owner", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(8);
    contract.registerPatent(
      hash,
      "Test Title",
      "Test Description",
      "pharma",
      100,
      10,
      5,
      "LocationX",
      "STX"
    );
    contract.caller = "ST3FAKE";
    const result = contract.updatePatent(0, "New Title", "New Description");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("transfers patent ownership successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(9);
    contract.registerPatent(
      hash,
      "Test Title",
      "Test Description",
      "pharma",
      100,
      10,
      5,
      "LocationX",
      "STX"
    );
    const result = contract.transferPatentOwnership(0, "ST4NEW");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const patent = contract.getPatent(0);
    expect(patent?.owner).toBe("ST4NEW");
    expect(contract.getPatentsByOwner("ST1TEST")).not.toContain(0);
    expect(contract.getPatentsByOwner("ST4NEW")).toContain(0);
  });

  it("rejects transfer for expired patent", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(10);
    contract.registerPatent(
      hash,
      "Test Title",
      "Test Description",
      "pharma",
      50,
      10,
      5,
      "LocationX",
      "STX"
    );
    contract.blockHeight = 60;
    const result = contract.transferPatentOwnership(0, "ST4NEW");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("verifies patent ownership correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(11);
    contract.registerPatent(
      hash,
      "Test Title",
      "Test Description",
      "pharma",
      100,
      10,
      5,
      "LocationX",
      "STX"
    );
    const result = contract.verifyPatentOwnership(0, "ST1TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const result2 = contract.verifyPatentOwnership(0, "ST5WRONG");
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("sets registration fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setRegistrationFee(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.registrationFee).toBe(1000);
    const hash = new Uint8Array(32).fill(12);
    contract.registerPatent(
      hash,
      "Test Title",
      "Test Description",
      "pharma",
      100,
      10,
      5,
      "LocationX",
      "STX"
    );
    expect(contract.stxTransfers).toEqual([{ amount: 1000, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects registration fee change without authority", () => {
    const result = contract.setRegistrationFee(1000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("returns correct patent count", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash1 = new Uint8Array(32).fill(13);
    contract.registerPatent(
      hash1,
      "Group1",
      "Desc1",
      "pharma",
      100,
      10,
      5,
      "LocationX",
      "STX"
    );
    const hash2 = new Uint8Array(32).fill(14);
    contract.registerPatent(
      hash2,
      "Group2",
      "Desc2",
      "biotech",
      200,
      20,
      10,
      "LocationY",
      "USD"
    );
    const result = contract.getPatentCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks patent existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(15);
    contract.registerPatent(
      hash,
      "Test Title",
      "Test Description",
      "pharma",
      100,
      10,
      5,
      "LocationX",
      "STX"
    );
    const result = contract.checkPatentExistence(hash);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const fakeHash = new Uint8Array(32).fill(16);
    const result2 = contract.checkPatentExistence(fakeHash);
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });
  
  it("rejects patent registration with empty title", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(17);
    const result = contract.registerPatent(
      hash,
      "",
      "Test Description",
      "pharma",
      100,
      10,
      5,
      "LocationX",
      "STX"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_TITLE);
  });

  it("rejects patent registration with max patents exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.state.maxPatents = 1;
    const hash1 = new Uint8Array(32).fill(18);
    contract.registerPatent(
      hash1,
      "Title1",
      "Desc1",
      "pharma",
      100,
      10,
      5,
      "LocationX",
      "STX"
    );
    const hash2 = new Uint8Array(32).fill(19);
    const result = contract.registerPatent(
      hash2,
      "Title2",
      "Desc2",
      "biotech",
      200,
      20,
      10,
      "LocationY",
      "USD"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_PATENTS_EXCEEDED);
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("rejects invalid authority contract", () => {
    const result = contract.setAuthorityContract("SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});