# 3D models

## exercise-figure.glb

The character in the Library's 3D exercise preview (`src/components/library/ExercisePreview3D.tsx`).

- **Source:** `Superhero_Male_FullBody` from Quaternius's
  [Universal Base Characters](https://quaternius.itch.io/universal-base-characters) (free Standard pack).
- **License:** CC0 1.0 Universal (public domain), per the pack's `License_Standard.txt`. No attribution
  required.
- **Changes:** eyebrows, textures, UVs and vertex colours removed; geometry quantized
  (`KHR_mesh_quantization`) with glTF-Transform. Skeleton (Unreal-style bone names) left as-is — the
  bone names in `src/utils/figureRig.ts` depend on it.
