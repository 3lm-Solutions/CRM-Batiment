import { frenchMessage, frenchMessages } from './validation-messages';
import { isPhone } from './phone.validator';

describe('Messages de validation en français', () => {
  it('rewrites class-validator default messages', () => {
    expect(frenchMessage('telephone', 'isString', 'telephone must be a string')).toBe(
      'Le téléphone doit être un texte.',
    );
    expect(frenchMessage('nom', 'isNotEmpty', 'nom should not be empty')).toBe(
      'Le nom est obligatoire.',
    );
    expect(frenchMessage('email', 'isEmail', 'email must be an email')).toBe(
      'L’email n’est pas une adresse email valide.',
    );
    expect(frenchMessage('quantite', 'min', 'quantite must not be less than 1')).toBe(
      'La quantité doit être au moins 1.',
    );
    expect(
      frenchMessage(
        'description',
        'maxLength',
        'description must be shorter than or equal to 2000 characters',
      ),
    ).toBe('La description ne peut pas dépasser 2000 caractères.');
    expect(frenchMessage('foo', 'whitelistValidation', 'property foo should not exist')).toBe(
      'Le champ « foo » n’est pas attendu.',
    );
  });

  it('keeps messages already written in French', () => {
    expect(frenchMessage('nom', 'isNotEmpty', 'Le nom est obligatoire')).toBe(
      'Le nom est obligatoire',
    );
  });

  it('flattens nested errors with the line number', () => {
    const errors = [
      {
        property: 'lignes',
        children: [
          {
            property: '0',
            children: [
              {
                property: 'quantite',
                constraints: { isPositive: 'quantite must be a positive number' },
                children: [],
              },
            ],
          },
        ],
      },
    ];
    expect(frenchMessages(errors as never)).toEqual(['La quantité doit être supérieur à 0.']);
  });
});

describe('Téléphone', () => {
  it('accepts French and foreign numbers, rejects the rest', () => {
    for (const ok of [
      '06 12 34 56 78',
      '0612345678',
      '+33 6 12 34 56 78',
      '+216 22 123 456',
      '22123456',
      '0801 234 5678',
      '(01) 45.67.89.00',
    ]) {
      expect(isPhone(ok)).toBe(true);
    }
    for (const ko of ['123', 'abc', '06 12 34 ab', '+1234567890123456', '']) {
      expect(isPhone(ko)).toBe(false);
    }
  });
});
