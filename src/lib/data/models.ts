export type RecipeType =
	| "Smelt"
	| "Assemble"
	| "Research"
	| "Chemical"
	| "Refine"
	| "Particle"
	| "Fractionate"
	| "Proliferator"
	| string;

export interface Item {
	Name: string;
	ID: number;
	SID: string;
	Type: string;
	SubID: number;
	MiningFrom: string;
	ProduceFrom: string;
	StackSize: number;
	Grade: number;
	Upgrades: number[];
	IsFluid: boolean;
	IsEntity: boolean;
	CanBuild: boolean;
	BuildInGas: boolean;
	IconPath: string;
	IconTag: string;
	ModelIndex: number;
	ModelCount: number;
	HpMax: number;
	Ability: number;
	HeatValue: number;
	Potential: number;
	ReactorInc: number;
	FuelType: number;
	AmmoType: string;
	BombType: string;
	CraftType: number;
	BuildIndex: number;
	BuildMode: number;
	GridIndex: number;
	UnlockKey: number;
	PreTechOverride: number;
	Productive: boolean;
	MechaMaterialID: number;
	DropRate: number;
	EnemyDropLevel: number;
	EnemyDropRange: { x: number; y: number };
	EnemyDropCount: number;
	EnemyDropMask: number;
	EnemyDropMaskRatio: number;
	DescFields: number[];
	Description: string;
	iconTagString: string;
	iconNameTagString: string;
}

export interface Recipe {
	Name: string;
	ID: number;
	SID: string;
	Type: RecipeType;
	Handcraft: boolean;
	Explicit: boolean;
	TimeSpend: number;
	Items: number[];
	ItemCounts: number[];
	Results: number[];
	ResultCounts: number[];
	GridIndex: number;
	IconPath: string;
	IconTag: string;
	Description: string;
	NonProductive: boolean;
	iconTagString: string;
	iconNameTagString: string;
}

export interface Tech {
	Name: string;
	ID: number;
	SID: string;
	Desc: string;
	Conclusion: string;
	Published: boolean;
	IsHiddenTech: boolean;
	IsObsolete: boolean;
	PreItem: number[];
	Level: number;
	MaxLevel: number;
	LevelCoef1: number;
	LevelCoef2: number;
	IconPath: string;
	IconTag: string;
	IsLabTech: boolean;
	PreTechs: number[];
	PreTechsImplicit: number[];
	PreTechsMax: boolean;
	Items: number[];
	ItemPoints: number[];
	PropertyOverrideItems: number[];
	PropertyItemCounts: number[];
	HashNeeded: number;
	UnlockRecipes: number[];
	UnlockFunctions: number[];
	UnlockValues: number[];
	AddItems: number[];
	AddItemCounts: number[];
	Position: { x: number; y: number };
	iconTagString: string;
	iconNameTagString: string;
}

export interface Theme {
	Name: string;
	ID: number;
	SID: string;
	DisplayName: string;
	BriefIntroduction: string;
	PlanetType: string;
	MaterialPath: string;
	Temperature: number;
	Distribute: string;
	Algos: number[];
	ModX: { x: number; y: number };
	ModY: { x: number; y: number };
	EigenBit: number;
	Vegetables0: number[];
	Vegetables1: number[];
	Vegetables2: number[];
	Vegetables3: number[];
	Vegetables4: number[];
	Vegetables5: number[];
	VeinSpot: number[];
	VeinCount: number[];
	VeinOpacity: number[];
	RareVeins: number[];
	RareSettings: number[];
	GasItems: number[];
	GasSpeeds: number[];
	UseHeightForBuild: boolean;
	Wind: number;
	IonHeight: number;
	WaterHeight: number;
	WaterItemId: number;
	Musics: number[];
	SFXPath: string;
	SFXVolume: number;
	CullingRadius: number;
	IceFlag: number;
}

export interface Vein {
	Name: string;
	ID: number;
	SID: string;
	IconPath: string;
	IconTag: string;
	Description: string;
	ModelIndex: number;
	ModelCount: number;
	CircleRadius: number;
	MiningItem: number;
	MiningTime: number;
	MiningAudio: number;
	MiningEffect: number;
	MinerBaseModelIndex: number;
	MinerCircleModelIndex: number;
	iconTagString: string;
	iconNameTagString: string;
	prefabDesc: unknown;
}

export interface ItemProtoSet {
	TableName: string;
	Signature: string;
	dataArray: Item[];
}

export interface RecipeProtoSet {
	TableName: string;
	Signature: string;
	dataArray: Recipe[];
}

export interface TechProtoSet {
	TableName: string;
	Signature: string;
	dataArray: Tech[];
}

export interface ThemeProtoSet {
	TableName: string;
	Signature: string;
	dataArray: Theme[];
}

export interface VeinProtoSet {
	TableName: string;
	Signature: string;
	dataArray: Vein[];
}

export interface ProtoSets {
	version: string;
	ItemProtoSet: ItemProtoSet;
	RecipeProtoSet: RecipeProtoSet;
	TechProtoSet: TechProtoSet;
	ThemeProtoSet: ThemeProtoSet;
	VeinProtoSet: VeinProtoSet;
}
