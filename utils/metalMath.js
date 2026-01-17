/**
 * MetalMath Physics Engine
 * Calculates weight, volume, and cost for metal stock based on shape, dimensions, and density.
 * 
 * IMPORTANT: All dimension inputs should be in MILLIMETERS (mm).
 * The functions convert to cm internally for volume calculations.
 */

// Standard Material Densities (g/cm³)
const DENSITIES = {
    steel: 7.85,      // Aço
    stainless: 7.90,  // Inox
    aluminum: 2.70,   // Alumínio
    brass: 8.50,      // Latão
    bronze: 8.80,     // Bronze
    plastic: 1.20,    // Plástico (média)
};

/**
 * Convert millimeters to centimeters
 * @param {number} mm - Value in millimeters
 * @returns {number} Value in centimeters
 */
const mmToCm = (mm) => mm / 10;

/**
 * Calculate volume of a round bar (cylinder)
 * V = π × radius² × length
 * 
 * @param {number} diameterMm - Diameter in mm
 * @param {number} lengthMm - Length in mm
 * @returns {number} Volume in cm³
 */
const volumeRoundBar = (diameterMm, lengthMm) => {
    const radiusCm = mmToCm(diameterMm) / 2;
    const lengthCm = mmToCm(lengthMm);
    return Math.PI * Math.pow(radiusCm, 2) * lengthCm;
};

/**
 * Calculate volume of a rectangular bar or plate
 * V = width × height × length
 * 
 * @param {number} widthMm - Width in mm
 * @param {number} heightMm - Height/thickness in mm
 * @param {number} lengthMm - Length in mm
 * @returns {number} Volume in cm³
 */
const volumeRectangular = (widthMm, heightMm, lengthMm) => {
    const widthCm = mmToCm(widthMm);
    const heightCm = mmToCm(heightMm);
    const lengthCm = mmToCm(lengthMm);
    return widthCm * heightCm * lengthCm;
};

/**
 * Calculate volume of a tube (hollow cylinder)
 * V = (π × outerR² - π × innerR²) × length
 * 
 * @param {number} outerDiameterMm - Outer diameter in mm
 * @param {number} wallThicknessMm - Wall thickness in mm
 * @param {number} lengthMm - Length in mm
 * @returns {number} Volume in cm³
 */
const volumeTube = (outerDiameterMm, wallThicknessMm, lengthMm) => {
    const outerRadiusCm = mmToCm(outerDiameterMm) / 2;
    const innerRadiusCm = outerRadiusCm - mmToCm(wallThicknessMm);
    const lengthCm = mmToCm(lengthMm);

    const outerArea = Math.PI * Math.pow(outerRadiusCm, 2);
    const innerArea = Math.PI * Math.pow(innerRadiusCm, 2);

    return (outerArea - innerArea) * lengthCm;
};

/**
 * Calculate volume of a hexagonal bar
 * V = (3√3 / 2) × s² × length, where s = flatToFlat / √3
 * 
 * @param {number} flatToFlatMm - Distance across flats in mm
 * @param {number} lengthMm - Length in mm
 * @returns {number} Volume in cm³
 */
const volumeHex = (flatToFlatMm, lengthMm) => {
    const flatToFlatCm = mmToCm(flatToFlatMm);
    const lengthCm = mmToCm(lengthMm);
    // Area of hexagon from flat-to-flat dimension: (sqrt(3)/2) × F²
    const area = (Math.sqrt(3) / 2) * Math.pow(flatToFlatCm, 2);
    return area * lengthCm;
};

/**
 * Calculate weight from volume and density
 * Weight (kg) = Volume (cm³) × Density (g/cm³) / 1000
 * 
 * @param {number} volumeCm3 - Volume in cm³
 * @param {number} densityGCm3 - Density in g/cm³
 * @returns {number} Weight in kg, rounded to 2 decimal places
 */
const calculateWeight = (volumeCm3, densityGCm3) => {
    const weightKg = (volumeCm3 * densityGCm3) / 1000;
    return Math.round(weightKg * 100) / 100; // Round to 2 decimal places
};

/**
 * Calculate length from weight, diameter, and density (reverse calculation)
 * Useful for: "How many meters do I have if I have X kg?"
 * 
 * @param {number} weightKg - Weight in kg
 * @param {number} diameterMm - Diameter in mm (for round bars)
 * @param {number} densityGCm3 - Density in g/cm³
 * @returns {number} Length in mm
 */
const lengthFromWeight = (weightKg, diameterMm, densityGCm3) => {
    const radiusCm = mmToCm(diameterMm) / 2;
    const crossSectionAreaCm2 = Math.PI * Math.pow(radiusCm, 2);
    const volumeCm3 = (weightKg * 1000) / densityGCm3;
    const lengthCm = volumeCm3 / crossSectionAreaCm2;
    return Math.round(lengthCm * 10); // Convert back to mm
};

/**
 * Get weight of a stock item based on shape and dimensions
 * Main function to be used by the application
 * 
 * @param {Object} params - Parameters object
 * @param {string} params.shape - Shape type: 'round', 'hex', 'tube', 'plate', 'box'
 * @param {Object} params.dimensions - Dimensions object with d, w, h, wall as applicable
 * @param {number} params.lengthMm - Length in mm
 * @param {number} params.density - Density in g/cm³ (or provide materialType)
 * @param {string} params.materialType - Material type if density not provided
 * @returns {number} Weight in kg
 */
const getWeight = ({ shape, dimensions, lengthMm, density, materialType }) => {
    // Get density from materialType if not provided directly
    const effectiveDensity = density || DENSITIES[materialType] || DENSITIES.steel;

    let volume;

    switch (shape) {
        case 'round':
            volume = volumeRoundBar(dimensions.d, lengthMm);
            break;
        case 'hex':
            volume = volumeHex(dimensions.d, lengthMm);
            break;
        case 'tube':
            volume = volumeTube(dimensions.d, dimensions.wall, lengthMm);
            break;
        case 'plate':
        case 'box':
            volume = volumeRectangular(dimensions.w, dimensions.h, lengthMm);
            break;
        default:
            throw new Error(`Unknown shape: ${shape}`);
    }

    return calculateWeight(volume, effectiveDensity);
};

/**
 * Convert weight to meters for round bars
 * Useful for dual display (Kg AND Meters)
 * 
 * @param {number} weightKg - Weight in kg
 * @param {number} diameterMm - Diameter in mm
 * @param {number} density - Density in g/cm³
 * @returns {number} Length in meters, rounded to 2 decimal places
 */
const weightToMeters = (weightKg, diameterMm, density = DENSITIES.steel) => {
    const lengthMm = lengthFromWeight(weightKg, diameterMm, density);
    return Math.round((lengthMm / 1000) * 100) / 100; // Convert to meters, round to 2 decimals
};

module.exports = {
    DENSITIES,
    volumeRoundBar,
    volumeRectangular,
    volumeTube,
    volumeHex,
    calculateWeight,
    lengthFromWeight,
    getWeight,
    weightToMeters,
    mmToCm,
};
