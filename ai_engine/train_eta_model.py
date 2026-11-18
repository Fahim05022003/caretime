"""
CareTime AI Engine - Dynamic Wait-Time Predictor
Trains LightGBM / GradientBoostingRegressor and exports ONNX model.
"""

import os
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error

# Try importing skl2onnx and onnx
try:
    from skl2onnx import convert_sklearn
    from skl2onnx.common.data_types import FloatTensorType
    import onnx
    HAS_SKL2ONNX = True
except ImportError:
    HAS_SKL2ONNX = False

# Try LightGBM, fallback to Scikit-Learn GradientBoostingRegressor
try:
    import lightgbm as lgb
    from onnxmltools import convert_lightgbm
    HAS_LIGHTGBM = True
except ImportError:
    HAS_LIGHTGBM = False

from sklearn.ensemble import GradientBoostingRegressor

def generate_synthetic_queue_data(n_samples=3000, random_state=42):
    """
    Generates realistic clinic queue data based on clinical outpatient observations.
    Features:
      - patients_ahead (0 - 30)
      - doctor_baseline_mins (7.0 - 18.0)
      - trailing_3_pace_mins (5.0 - 25.0)
      - weighted_visit_units (0.0 - 40.0)
      - doctor_delay_mins (0 - 90)
    """
    rng = np.random.RandomState(random_state)
    
    patients_ahead = rng.randint(0, 31, size=n_samples).astype(float)
    doctor_baseline = rng.uniform(7.0, 16.0, size=n_samples)
    
    # trailing pace correlates with baseline but has variability (fatigue or rush)
    trailing_pace = doctor_baseline * rng.uniform(0.75, 1.4, size=n_samples)
    trailing_pace = np.clip(trailing_pace, 5.0, 26.0)
    
    # visit weights: average ~1.1 per patient ahead with random variations
    visit_weights = []
    for count in patients_ahead:
        if count == 0:
            visit_weights.append(0.0)
        else:
            # Random mix of New (1.4), Follow-up (1.0), Report (0.5)
            types = rng.choice([1.4, 1.0, 0.5], size=int(count), p=[0.4, 0.45, 0.15])
            visit_weights.append(float(np.sum(types)))
    weighted_visit_units = np.array(visit_weights)
    
    # Doctor delays (0 to 60 minutes)
    delay_prob = rng.rand(n_samples)
    doctor_delay = np.where(delay_prob > 0.6, rng.choice([10.0, 15.0, 20.0, 30.0, 45.0], size=n_samples), 0.0)
    
    # Target calculation: actual wait time minutes
    # Blend of baseline and trailing pace, modulated by visit complexity units + delay + minor stochastic noise
    blended_pace = 0.4 * doctor_baseline + 0.6 * trailing_pace
    expected_consult_wait = weighted_visit_units * blended_pace
    stochastic_noise = rng.normal(0, 1.5, size=n_samples)
    
    wait_time_minutes = np.maximum(0.0, expected_consult_wait + doctor_delay + stochastic_noise)
    # If 0 patients ahead and no delay, wait is near 0
    wait_time_minutes = np.where(patients_ahead == 0, np.maximum(0.0, doctor_delay), wait_time_minutes)
    
    df = pd.DataFrame({
        'patients_ahead': patients_ahead,
        'doctor_baseline_mins': doctor_baseline,
        'trailing_3_pace_mins': trailing_pace,
        'weighted_visit_units': weighted_visit_units,
        'doctor_delay_mins': doctor_delay,
        'wait_time_minutes': wait_time_minutes
    })
    return df

def main():
    print("[CareTime AI] Generating 3,000 synthetic clinical queue samples...")
    df = generate_synthetic_queue_data(3000)
    
    feature_cols = [
        'patients_ahead',
        'doctor_baseline_mins',
        'trailing_3_pace_mins',
        'weighted_visit_units',
        'doctor_delay_mins'
    ]
    X = df[feature_cols].values.astype(np.float32)
    y = df['wait_time_minutes'].values.astype(np.float32)
    
    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)
    
    models_dir = os.path.join(os.path.dirname(__file__), 'models')
    os.makedirs(models_dir, exist_ok=True)
    onnx_path = os.path.join(models_dir, 'eta_model.onnx')
    meta_path = os.path.join(models_dir, 'eta_model_metadata.json')
    
    print(f"[CareTime AI] Training regression model on {len(X_train)} samples...")
    
    # Train Scikit-Learn GradientBoostingRegressor (ensures universal ONNX compatibility)
    regressor = GradientBoostingRegressor(
        n_estimators=100,
        learning_rate=0.08,
        max_depth=4,
        random_state=42
    )
    regressor.fit(X_train, y_train)
    
    val_preds = regressor.predict(X_val)
    mae = mean_absolute_error(y_val, val_preds)
    rmse = np.sqrt(mean_squared_error(y_val, val_preds))
    print(f"[CareTime AI] Validation MAE: {mae:.2f} minutes | RMSE: {rmse:.2f} minutes")
    
    # Export to ONNX if skl2onnx available
    onnx_exported = False
    if HAS_SKL2ONNX:
        try:
            initial_type = [('float_input', FloatTensorType([None, 5]))]
            onx = convert_sklearn(regressor, initial_types=initial_type, target_opset=12)
            with open(onnx_path, 'wb') as f:
                f.write(onx.SerializeToString())
            print(f"[CareTime AI] ONNX model successfully saved to: {onnx_path}")
            onnx_exported = True
        except Exception as e:
            print(f"[CareTime AI] ONNX export failed: {e}")
    else:
        print("[CareTime AI] skl2onnx not installed; skipping ONNX binary file generation.")
        
    # Save model weights & metadata for deterministic mathematical runtime
    metadata = {
        "model_type": "GradientBoostingRegressor",
        "feature_names": feature_cols,
        "n_samples": 3000,
        "validation_mae": round(float(mae), 3),
        "onnx_exported": onnx_exported,
        "feature_importances": regressor.feature_importances_.tolist() if hasattr(regressor, 'feature_importances_') else []
    }
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2)
    print(f"[CareTime AI] Metadata & fallback parameters saved to: {meta_path}")

if __name__ == '__main__':
    main()
